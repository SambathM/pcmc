using Localize.Logger;

namespace TelegramEngine.Logics
{
    public sealed class BusinessInstance
    {
        public BusinessInstance(string? instanceId, /*TenantObject tenant,*/ string? phone)
        {
            InstanceId = instanceId;
            //ConnString = tenant.ConnString;
            //Name = tenant.Name;
            Phone = phone;
            //BusinessId = tenant.BusinessId;
        }

        public BusinessInstance(string? instanceId, /*TenantObject tenant,*/ long userId, string? groupName)
        {
            InstanceId = instanceId;
            //ConnString = tenant.ConnString;
            //Name = tenant.Name;
            //BusinessId = tenant.BusinessId;
            UserId = userId;
            GroupName = groupName;
        }

        public LocalizeLogger<BusinessInstance> Logger { get; } = new();

        public string? InstanceId { get; set; }
        //public string ConnString { get; private set; }
        public string? GroupName { get; set; }
        public long UserId { get; set; }
        public string? Phone { get; private set; }
        //public string Name { get; private set; }
        //public long BusinessId { get; private set; }
        public string GetSignalRClientId()
        {
            //if (string.IsNullOrWhiteSpace(GroupName))
            //    GroupName = NpsqlUtility.GetDbName(ConnString).Removes("acc_", "rel_", "dev_", "dir_", "prod_");

            return $"{UserId}-{GroupName}";
        }
        public void SetPhone(string? phone) => Phone = phone;
    }

}
