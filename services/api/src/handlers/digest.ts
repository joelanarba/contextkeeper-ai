import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { repo } from '../db/repo.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';

const ses = new SESClient({});
const SENDER_EMAIL = process.env.SENDER_EMAIL;

export const handler = async (event: any): Promise<void> => {
  console.log('Running weekly digest generation...', JSON.stringify(event));

  if (!SENDER_EMAIL) {
    throw new Error('SENDER_EMAIL environment variable is missing');
  }

  try {
    // For MVP, we use the mock user ID. In production, we'd query all active users.
    const userId = 'test-user-123';
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
