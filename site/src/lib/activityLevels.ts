export type ActivityKey = 'dice' | 'blackjack' | 'heists' | 'duty' | 'ration';
export type ActivityLevel = {
  key: ActivityKey; label: string; level: number; xp: number; levelStartXp: number; nextLevelXp: number;
  completed: number; wins: number; naturals: number; activeDays: number; currentRun: number; bestRun: number;
  todayCompleted: number; dailyLimit: number; xpPerAction: number; firstDayBonus: number;
  milestones: { days: number; earned: boolean }[];
  rewards: { level: number; titleId: string; name: string; earned: boolean }[];
};
