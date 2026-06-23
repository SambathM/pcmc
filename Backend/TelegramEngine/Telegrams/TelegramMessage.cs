using Library.Helpers;
using System.Text.Json.Serialization;

namespace TelegramEngine.Telegrams
{
    public class TelegramMessage
    {
        private ContactStates[]? _contactStates;
        /// <summary>
        /// telegram session id 
        /// </summary>
        public long TSessionId { get; set; }
        public long[] ContactIds { get; set; } = [];
        public ContactStates[] ContactStates
        {
            get
            {
                if (_contactStates == null && ContactIds != null)
                {
                    _contactStates = [.. ContactIds.Select(x => new ContactStates { ContactId = x })];
                }
                return _contactStates ?? [];
            }
            set
            {
                _contactStates = value
                    ?? [
                        .. ContactIds?.Select(x => new ContactStates { ContactId = x })
                        ?? []
                    ];
            }
        }
        public string? ReceiverName { get; set; }
        /// <summary>
        /// telegram log description
        /// </summary>
        public string? Description { get; set; }
        public string? ContentType { get; set; } = StorageContent.pdf;
        public string? Content { get; set; }
        /// <summary>
        /// telegram caption message
        /// </summary>
        public string? Caption { get; set; }

        /// <summary>
        /// file path to send via telegram
        /// </summary>
        public string? FilePath { get; set; }
        /// <summary>
        /// Indicates if the message is sent to all contacts
        /// </summary>
        public bool IsSent { get; set; } = false;
        public string? Reason { get; set; }
        /// <summary>
        /// Should be InvoiceId etc,.
        /// </summary>
        public int? TranId { get; set; }
        //public EAccTranType? AccountTranTypeId { get; set; }
        //public EPaperKind PaperKind { get; set; }
        public EOrientation Orientation { get; set; } = EOrientation.Portrait;
        public bool ReturnAsImage { get; set; }

        public string? TranNo { get; set; }
        public decimal TranGrandTotal { get; set; }
        public string? TranCurrencySign { get; set; }
        // INVOICE
        public decimal ARInvoice { get; set; }
        public string? DueDateInvoice { get; set; }
        public List<TMessageTranDetail> TranDetails { get; set; } = [];

        /// <summary>
        /// merchant id to bank merchant to insert qr code to invoice
        /// </summary>
        public int? BankMerchantId { get; set; }

        /// <summary>
        /// settle payment when customer scans to pay
        /// </summary>
        public bool SettlePayment { get; set; } = false;

        /// <summary>
        /// send receipt back to customer when received payment
        /// </summary>
        public bool SendReceipt { get; set; } = false;

        /// <summary>
        /// html template for receipt to send when received payment
        /// </summary>
        public string? ReceiptTemplate { get; set; }

        public decimal PaywayAmountToPay { get; set; }
        [JsonIgnore]
        public string? PaywayTranId { get; set; }

        /// <summary>
        /// Checks if all contacts have been sent. Returns true if all contact states indicate they are sent.
        /// </summary>
        public bool AllSent => ContactStates.All(x => x.IsSent);
    }

    public enum EOrientation
    {
        Portrait = 1,
        Landscape = 2,
    }

    public class ContactStates
    {
        public long ContactId { get; set; }
        public bool IsSent { get; set; } = false;
        public string? SendTo { get; set; }
    }

    public class TMessageTranDetail
    {
        public string? InvoiceNo { get; set; }
        public int InvoicePaymentId { get; set; }
    }
}
