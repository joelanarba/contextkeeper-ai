import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { repo } from '../db/repo.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';

const ses = new SESClient({});
const cognito = new CognitoIdentityProviderClient({});
const SENDER_EMAIL = process.env.SENDER_EMAIL;
const USER_POOL_ID = process.env.USER_POOL_ID;

export const handler = async (event: any): Promise<void> => {
  console.log('Running weekly digest generation...', JSON.stringify(event));

  if (!SENDER_EMAIL) {
    throw new Error('SENDER_EMAIL environment variable is missing');
  }
  if (!USER_POOL_ID) {
    throw new Error('USER_POOL_ID environment variable is missing');
  }

  try {
    // For MVP, we get the first user from Cognito (single user app)
    const usersRes = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 1,
    }));
    
    const users = usersRes.Users || [];
    if (users.length === 0) {
      console.log('No users found in Cognito. Skipping digest.');
      return;
    }

    const user = users[0];
    if (!user) return;

    // The userId is the user's sub attribute, or username if sub is not found
    const subAttr = user.Attributes?.find((a: any) => a.Name === 'sub');
    const userId = subAttr ? subAttr.Value : user.Username;
    
    if (!userId) {
       console.log('User has no sub or username. Skipping.');
       return;
    }

    const allItems = await repo.listItems(userId);

    // Filter to open items only to include in the digest
    const openItems = allItems.filter(item => item.status === 'OPEN');

    if (openItems.length === 0) {
      console.log('No open items to report. Skipping digest.');
      return;
    }

    // Synthesize the email using GPT-4o-mini
    const currentDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
    const emailBody = await OpenAIProvider.synthesizeDigest(openItems, currentDate);

    // Send via SES
    const command = new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: {
        ToAddresses: [SENDER_EMAIL], // Sending to self for MVP
      },
      Message: {
        Subject: {
          Data: `Your ContextKeeper Weekly Digest - ${currentDate}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: emailBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    await ses.send(command);
    console.log('Weekly digest email sent successfully.');
  } catch (error) {
    console.error('Failed to generate or send weekly digest:', error);
    throw error; // Let Lambda register the failure
  }
};
