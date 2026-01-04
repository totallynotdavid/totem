WHATSAPP BUSINESS PERMANENT TOKEN

Open the Business Manager settings at: https://business.facebook.com/settings

Navigate to Users, then System users, and create a new system user. The name is
arbitrary. Assign the Admin role. This user exists solely for automation and
should not be used for interactive login.

Once the system user exists, assign assets to it. Grant full control of the
WhatsApp application by enabling "Manage app". Grant full control of the
WhatsApp Business Account by enabling "Manage WhatsApp Business Accounts".
Without both assignments, token generation will succeed but API calls will fail
with permission errors.

With the system user selected, generate an access token. Choose the WhatsApp
app, enable the business_management, whatsapp_business_messaging, and
whatsapp_business_management permissions, and set the expiration to "Never".
Copy the token.

To verify the token, send a test message through the Graph API. Replace the
token and destination phone number with your own values.

```bash
curl 'https://graph.facebook.com/v23.0/951170611408466/messages' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <TOKEN>' \
  -d '{
    "messaging_product": "whatsapp",
    "to": "<PHONE>",
    "type": "text",
    "text": {
      "body": "Testing permanent token"
    }
  }'
```

If the request returns success and the message is delivered, the token is valid
and correctly scoped. Authorization failures indicate missing asset assignment
or insufficient permissions on the system user.

Nothing else is required.
