export interface AccountDTO { id: string; name: string; kind: string; balance: number; openingBalance: number; isOwner: boolean; shared: boolean; sharedWith: string[] }
export interface TxDTO { id: string; accountId: string; date: string; amount: number; category: string; description: string; merchant: string | null; recurring: boolean; upcoming: boolean; source: string; by: string }
