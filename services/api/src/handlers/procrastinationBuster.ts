import { CognitoIdentityProviderClient, ListUsersCommand } from '@aws-sdk/client-cognito-identity-provider';
import { repo } from '../db/repo.js';
import { OpenAIProvider } from '../llm/OpenAIProvider.js';
import crypto from 'node:crypto';
import type { Item } from '@contextkeeper/core';

const cognito = new CognitoIdentityProviderClient({});
const USER_POOL_ID = process.env.USER_POOL_ID;

export const handler = async (event: any): Promise<void> => {
  console.log('Running procrastination buster...', JSON.stringify(event));

  if (!USER_POOL_ID) {
    throw new Error('USER_POOL_ID environment variable is missing');
  }

  try {
    const usersRes = await cognito.send(new ListUsersCommand({
      UserPoolId: USER_POOL_ID,
      Limit: 1,
    }));
    
    const users = usersRes.Users || [];
    if (users.length === 0) return;

    const user = users[0];
    if (!user) return;

    const subAttr = user.Attributes?.find((a: any) => a.Name === 'sub');
    const userId = subAttr ? subAttr.Value : user.Username;
    
    if (!userId) return;

    const allItems = await repo.listItems(userId);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

    // Find stalled tasks: OPEN, created > 3 days ago, and never updated (or not updated in 3 days), no subtasks yet
    const stalledTasks = allItems.filter(item => 
      item.type === 'TASK' && 
      item.status === 'OPEN' && 
      item.createdAt < threeDaysAgo && 
      item.updatedAt < threeDaysAgo &&
      !item.hasSubtasks &&
      !item.parentItemId
    );

    if (stalledTasks.length === 0) {
      console.log('No stalled tasks found.');
      return;
    }

    // Process up to 5 tasks per run to save costs
    const tasksToProcess = stalledTasks.slice(0, 5);

    for (const task of tasksToProcess) {
      console.log(`Decomposing task: ${task.title}`);
      
      const subtasks = await OpenAIProvider.decomposeTask(task);
      
      if (subtasks && subtasks.length > 0) {
        // Create new subtask items
        const now = new Date().toISOString();
        const itemsToSave: Item[] = subtasks.map(st => ({
          id: crypto.randomUUID(),
          userId,
          type: 'TASK',
          title: st.title,
          priority: task.priority,
          status: 'OPEN',
          sourceCaptureId: task.sourceCaptureId,
          createdAt: now,
          updatedAt: now,
          schemaVersion: 1,
          parentItemId: task.id,
        }));

        // Use saveExtractedItems to batch write them
        await repo.saveExtractedItems(userId, now, task.sourceCaptureId, itemsToSave);
        
        // Update parent to have hasSubtasks = true
        await repo.updateItem(userId, task.id, { hasSubtasks: true });
      }
    }

    console.log('Procrastination buster completed successfully.');
  } catch (error) {
    console.error('Failed to run procrastination buster:', error);
    throw error;
  }
};
