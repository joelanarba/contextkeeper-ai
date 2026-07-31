export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Add other UI constants here if needed
export const COLORS = {
  PRIORITY: {
    HIGH: 'bg-red-100 text-red-700 border-red-200',
    MEDIUM: 'bg-zinc-100 text-zinc-700 border-zinc-200',
    LOW: 'bg-gray-50 text-gray-500 border-gray-100'
  },
  TYPE: {
    TASK: 'border-zinc-200',
    IDEA: 'border-zinc-200',
    NOTE: 'border-zinc-200',
    FOLLOW_UP: 'border-zinc-200',
    PROJECT: 'border-zinc-200'
  }
};
