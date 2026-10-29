export interface GmailMessageHeader {
  name: string;
  value: string;
}

export interface GmailMessagePart {
  partId?: string;
  mimeType: string;
  filename?: string;
  headers?: GmailMessageHeader[];
  body?: {
    size: number;
    data?: string; // base64url encoded
  };
  parts?: GmailMessagePart[];
}

export interface GmailMessageSummary {
  id: string;
  threadId: string;
}

export interface GmailMessageDetail {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate?: number;
  raw?: string;
}

export interface GmailListResponse {
  messages?: GmailMessageSummary[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}

export interface ParsedEmailTransaction {
  id: string;
  amount: number;
  transactionTime: string;
  description: string;
  source: 'momo' | 'vcb' | 'tcb' | 'mbbank' | 'tpbank' | 'generic';
  rawPayload: string;
}
