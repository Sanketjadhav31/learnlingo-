/**
 * Progress Service Module
 * 
 * Computes user progress metrics from state and curriculum.
 * Provides dashboard data showing completed days, topics, and upcoming content.
 */

const { CURRICULUM, getTopicForDay } = require('./curriculum');

/**
 * Get user progress dashboard data
 * @param {Object} state - User state
 * @returns {Object} Progress dashboard data
 */
function getUserProgress(state) {
  const totalDays = CURRICULUM.length; // 126 days
  const completed = (state.currentDay || 1) - 1;
  const revisionDaysPassed = Math.floor(completed / 7);
  const normalDaysPassed = completed - revisionDaysPassed;
  
  // Calculate current week and day in week
  const currentWeek = Math.ceil((state.currentDay || 1) / 7);
  const dayInCurrentWeek = ((state.currentDay || 1) - 1) % 7 + 1;
  const nextRevisionDay = Math.ceil((state.currentDay || 1) / 7) * 7;
  const daysUntilNextRevision = nextRevisionDay - (state.currentDay || 1) + 1;
  
  // Build topic map from curriculum and score history
  const topicMap = CURRICULUM.slice(0, completed).map(entry => {
    const dayScore = (state.scoreHistory || []).find(s => s.dayNumber === entry.day);
    return {
      day: entry.day,
      topic: entry.topic,
      category: entry.category,
      level: entry.level,
      weekNumber: entry.weekNumber,
      dayInWeek: entry.dayInWeek,
      score: dayScore?.overallPercent || null,
      tier: dayScore?.tier || null,
      passFail: dayScore?.passFail || null,
      completed: !!dayScore,
    };
  });
  
  // Get upcoming topics (next 7 days)
  const upcomingTopics = CURRICULUM.slice(completed, completed + 7).map(entry => ({
    day: entry.day,
    topic: entry.topic,
    category: entry.category,
    level: entry.level,
    weekNumber: entry.weekNumber,
    dayInWeek: entry.dayInWeek,
    isRevisionDay: entry.category === 'revision',
  }));
  
  // Calculate level breakdown
  const levelBreakdown = {
    beginner: topicMap.filter(t => t.level === 'beginner' && t.completed).length,
    intermediate: topicMap.filter(t => t.level === 'intermediate' && t.completed).length,
    advanced: topicMap.filter(t => t.level === 'advanced' && t.completed).length,
  };
  
  // Calculate category breakdown
  const categoryBreakdown = {
    grammar: topicMap.filter(t => t.category === 'grammar' && t.completed).length,
    tense: topicMap.filter(t => t.category === 'tense' && t.completed).length,
    vocabulary: topicMap.filter(t => t.category === 'vocabulary' && t.completed).length,
    speaking: topicMap.filter(t => t.category === 'speaking' && t.completed).length,
    writing: topicMap.filter(t => t.category === 'writing' && t.completed).length,
    reading: topicMap.filter(t => t.category === 'reading' && t.completed).length,
    revision: topicMap.filter(t => t.category === 'revision' && t.completed).length,
  };
  
  // Get revision scores history
  const revisionScores = (state.revisionScores || []).map(rev => ({
    revisionDay: rev.revisionDay,
    weekNumber: rev.weekNumber,
    overallScore: rev.overallRevisionScore,
    topicBreakdown: rev.topicBreakdown,
    date: rev.date,
  }));
  
  return {
    // Overall progress
    daysCompleted: completed,
    totalDays,
    percentComplete: Math.round((completed / totalDays) * 100),
    estimatedDaysRemaining: totalDays - completed,
    
    // Weekly breakdown
    currentWeek,
    dayInCurrentWeek,
    nextRevisionDay,
    daysUntilNextRevision,
    
    // Topic map - what was learned on each day
    topicMap,
    
    // Upcoming topics (next 7 days preview)
    upcomingTopics,
    
    // Level and category breakdown
    levelBreakdown,
    categoryBreakdown,
    
    // Revision scores history
    revisionScores,
    
    // Current curriculum topic
    currentCurriculumTopic: getTopicForDay(state.currentDay || 1).topic,
    
    // Streak and performance
    streak: state.tracker?.streak || 0,
    longestStreak: state.tracker?.longestStreak || 0,
    averageScore: state.tracker?.averageScore || 0,
    totalSubmissions: state.tracker?.totalSubmissions || 0,
  };
}

module.exports = {
  getUserProgress,
};
