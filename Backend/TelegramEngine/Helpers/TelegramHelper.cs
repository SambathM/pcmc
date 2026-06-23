using Library.Models;
using Localize.Helper.Extensions;
using Localize.Logger;
using TelegramEngine.Models;
using TelegramEngine.Telegrams;
using TelegramEngine.Telegrams.Enums;
using TL;
using TLUser = TL.User;

namespace TelegramEngine.Helpers
{
    internal static class TelegramHelper
    {
        private static readonly LocalizeLogger Logger = new(typeof(TelegramHelper));
        public static async Task<ETAuthorizationState> AuthorizationStateAsync(this WTelegram.Client client,
            long accessHash,
            Func<Task>? onLostConnection = null)
        {
            try
            {
                if (!await client.IsAuthorizedAsync().ConfigureAwait(false))
                    return ETAuthorizationState.NotLoggedIn; // add this enum value

                var userBase = new InputUser(client.UserId, accessHash);
                await client.Users_GetFullUser(userBase);
                return ETAuthorizationState.Valid;
            }
            catch (Exception e)
            {
                var msg = e.Message ?? string.Empty;

                if (msg.Contains("AUTH_KEY_UNREGISTERED", StringComparison.OrdinalIgnoreCase))
                {
                    // If IsAuthorizedAsync was false earlier, it is simply not logged in.
                    if (!await client.IsAuthorizedAsync().ConfigureAwait(false))
                        return ETAuthorizationState.NotLoggedIn;

                    return ETAuthorizationState.Unauthorized;
                }

                if (msg.Contains("CONNECTION_NOT_INITED", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("USER_ID_INVALID", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("_MIGRATE_", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("FLOOD_WAIT_", StringComparison.OrdinalIgnoreCase))
                {
                    if (onLostConnection != null)
                        await onLostConnection();
                    return ETAuthorizationState.LostConnection;
                }

                Logger.Warn("AuthorizationStateAsync fallback Unauthorized. Ex={0}", msg);
                return ETAuthorizationState.Unauthorized;
            }
        }


        public static async Task<InputFileBase?> TryToUploadFileAsync(this WTelegram.Client client, string file)
        {
            try
            {
                return await client.UploadFileAsync(file);
            }
            catch (Exception e)
            {
                Console.WriteLine(e.ToString());
                return null;
            }
        }


        public static async Task<TelegramStatus> TryGetAllContacts(this WTelegram.Client client)
        {
            try
            {
                var __dialogs = await client.Contacts_GetContacts();
                return new() { Status = ETelegramStatus.Valid, Data = __dialogs };
            }
            catch (Exception ex)
            {
                return new(GetErrorStatus(ex.Message));
            }
        }


        public static async Task<TelegramStatus> TryGetAllChats(this WTelegram.Client client)
        {
            try
            {
                Messages_Chats __dialogs = await client.Messages_GetAllChats();
                return new() { Status = ETelegramStatus.Valid, Data = __dialogs };
            }
            catch (Exception ex)
            {
                return new() { Status = GetErrorStatus(ex.Message) };
            }
        }

        public static async Task<TelegramStatus> TrySendMessageAsync(this WTelegram.Client client, InputPeer inputPeer,
            string message, InputMedia? media = null, MessageEntity[]? entities = null)
        {
            try
            {
                //send message
                TL.Message messageResult = await client.SendMessageAsync(inputPeer, message, media, entities: entities);
                return new()
                {
                    Status = ETelegramStatus.Valid,
                    Data = messageResult
                };
            }
            catch (Exception ex)
            {
                return new() { Status = GetErrorStatus(ex.ToString()) };
            }
        }

        public static async Task<IPeerInfo?> PeerInfo(this WTelegram.Client client, TelegramContact contact)
        {
            try
            {
                bool isGroupOrChannel = contact.IsGroup != null;
                InputDialogPeer __dialogPeer = new() { peer = contact.InputPeer() };
                Messages_PeerDialogs __dialogs = await client.Messages_GetPeerDialogs([__dialogPeer]);

                //get peerInfo to use to download profile photo
                IPeerInfo __peerInfo = isGroupOrChannel
                    //for group chat
                    ? __dialogs.chats[contact.TContactId]
                    //for user chat
                    : __dialogs.UserOrChat(contact.IsChat
                        ? new PeerChat { chat_id = contact.TContactId }
                        : new PeerUser { user_id = contact.TContactId });

                return __peerInfo;
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
                return null;
            }
        }

        public static async Task<IPeerInfo?> PeerInfo(this WTelegram.Client client, long chatId)
        {
            try
            {
                InputDialogPeer __dialogPeer = new() { peer = new InputPeerChat(chatId) };
                Messages_PeerDialogs __dialogs = await client.Messages_GetPeerDialogs([__dialogPeer]);

                return __dialogs.UserOrChat(new PeerChat() { chat_id = chatId });
            }
            catch (Exception e)
            {
                Console.WriteLine(e.Message);
                return null;
            }
        }

        public static async Task<string?> TryDownloadProfilePhotoAsync(this WTelegram.Client client, long accessHash)
            => await client.TryDownloadProfilePhotoAsync(new TelegramContact() { TContactId = client.UserId, AccessHash = accessHash });

        public static async Task<string?> TryDownloadProfilePhotoAsync(this WTelegram.Client client,
            TelegramContact contact, bool miniThumb = false)
        {
            try
            {
                IPeerInfo? peerInfo = await client.PeerInfo(contact);
                string? downloadFile = null,
                    tempDownloadFile = Path.GetTempFileName();
                Storage_FileType downloadedType = 0;
                using (FileStream stream = File.OpenWrite(tempDownloadFile))
                {
                    //download and write downloaded file to stream
                    downloadedType = await client.DownloadProfilePhotoAsync(peerInfo, stream, miniThumb: miniThumb);
                }

                //if file downloaded or profile photo exists
                if (downloadedType != 0)
                {
                    downloadFile = Path.GetTempFileName().Split(".")[0] + "." + downloadedType.ToString();
                    //move downloaded file to specific file with file extension
                    File.Move(tempDownloadFile, downloadFile);
                }

                return downloadFile;
            }
            catch (Exception)
            {
                throw;
            }
        }

        /// <summary>
        /// Get the input peer for the contact
        /// </summary>
        /// <param name="contact"></param>
        /// <returns></returns>
        public static InputPeer InputPeer(this TelegramContact contact)
        {
            bool isGroupChannelOrChat = contact.IsGroup != null || contact.IsChat;
            InputPeer __inputPeer = isGroupChannelOrChat
                    ? contact.AccessHash != null
                        //supergroup/channel chat
                        ? new InputPeerChannel(contact.TContactId, (long)contact.AccessHash)
                        //basic group chat
                        : new InputPeerChat(contact.TContactId)
                    //user chat
                    : new InputPeerUser(contact.TContactId, (long)(contact.AccessHash ?? 0));
            return __inputPeer;
        }

        public static async Task<UpdatesBase?> TryForwardMessages(this WTelegram.Client client, InputPeer fromPeer, int[] messageIds, InputPeer toPeer)
        {
            try
            {
                var __randoms = messageIds.Select(x => WTelegram.Helpers.RandomLong()).ToArray();
                var __baseUpdate = await client.Messages_ForwardMessages(fromPeer, messageIds, __randoms, toPeer, drop_author: true);
                return __baseUpdate;
            }
            catch (Exception)
            {
                return null;
            }
        }

        public static TelegramContact ContactMapper(this TLUser tUser, TelegramContact contact)
        {
            contact.SessionContacts?.ForEach(x =>
            {
                x.FirstName = tUser.first_name;
                x.LastName = tUser.last_name;
            });

            contact.Username = tUser.username;
            contact.Phone = tUser.phone;
            contact.TContactId = (int)tUser.ID;
            return contact;
        }

        public static TelegramContact OnAddNewContactMapper(this TLUser tUser, long _, int? id = null)
        {
            TelegramContact contact = new()
            {
                Id = id ?? 0,
                TContactId = tUser.id,
                AccessHash = tUser.access_hash,
                Phone = tUser.phone,
                Username = tUser.username,
            };

            return contact;
        }


        public static ETelegramStatus GetErrorStatus(string message)
        {
            message = message.ToLower();
            var __status = message.Contains("password")
                    ? ETelegramStatus.NeedPassword
                    : message.Contains("auth_restart")
                            || message.Contains("auth_key_unregistered")
                            //user cleared session from device app
                            || message.Contains("session_revoked")
                        ? ETelegramStatus.AuthRestart
                        : message.Contains("phone_code_expired")
                            ? ETelegramStatus.CodeExpired
                            : message.Contains("phone_not_occupied")
                                ? ETelegramStatus.PhoneNotOccupied
                                : message.Contains("flood_wait_x")
                                    ? ETelegramStatus.FloodWaitX
                                    : ETelegramStatus.UnknownError;
            return __status;
        }


        internal static object ToDbNullValue(this object value) => value ?? DBNull.Value;

        internal static bool IsChannel(this KeyValuePair<long, ChatBase> pair, out Channel? channel)
        {
            if (pair.Value.GetType() == typeof(Channel))
            {
                channel = (Channel)pair.Value;
                return true;
            }

            channel = null;
            return false;
        }

    }//class
}//namespace
