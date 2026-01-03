
import { SRTBlock } from '../types';

/**
 * Parses time string (00:00:00,000) to seconds
 */
const parseTimestamp = (timeStr: string): number => {
  const [hours, minutes, secondsAndMillis] = timeStr.split(':');
  const [seconds, millis] = secondsAndMillis.split(',');
  return (
    parseInt(hours) * 3600 +
    parseInt(minutes) * 60 +
    parseInt(seconds) +
    parseInt(millis) / 1000
  );
};

export const parseSRT = (content: string): SRTBlock[] => {
  const blocks: SRTBlock[] = [];
  // Normalize line endings and split by empty lines
  const rawBlocks = content.trim().split(/\r?\n\s*\r?\n/);

  for (const block of rawBlocks) {
    const lines = block.split(/\r?\n/);
    if (lines.length >= 3) {
      const index = lines[0].trim();
      const timestamp = lines[1].trim();
      const text = lines.slice(2).join('\n').trim();

      const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/);
      if (timeMatch) {
        const startTime = parseTimestamp(timeMatch[1]);
        const endTime = parseTimestamp(timeMatch[2]);
        blocks.push({
          index,
          timestamp,
          content: text,
          startTime,
          endTime,
          duration: endTime - startTime,
        });
      }
    }
  }
  return blocks;
};

export const buildSRT = (blocks: SRTBlock[]): string => {
  return blocks
    .map((block) => {
      return `${block.index}\n${block.timestamp}\n${block.content}\n`;
    })
    .join('\n');
};
