
export interface SRTBlock {
  index: string;
  timestamp: string;
  content: string;
  startTime: number;
  endTime: number;
  duration: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  progress: number;
  error: string | null;
  result: SRTBlock[] | null;
}
