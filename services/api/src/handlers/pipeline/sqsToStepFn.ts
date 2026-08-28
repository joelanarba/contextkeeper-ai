import type { SQSEvent } from 'aws-lambda';
import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfn = new SFNClient({});
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

export const handler = async (event: SQSEvent): Promise<void> => {
  if (!STATE_MACHINE_ARN) throw new Error('STATE_MACHINE_ARN is missing');

  for (const record of event.Records) {
    let payload;
    try {
      payload = JSON.parse(record.body);
    } catch {
      console.error('Failed to parse SQS message body:', record.body);
      continue;
    }

    const { userId, captureId, createdAt } = payload;
    if (!userId || !captureId || !createdAt) {
      console.error('Invalid SQS payload structure:', payload);
      continue;
    }

    // Start Step Functions execution
    await sfn.send(
      new StartExecutionCommand({
        stateMachineArn: STATE_MACHINE_ARN,
        input: JSON.stringify(payload),
        name: `${captureId}-${Date.now()}`,
      })
    );
  }
};
