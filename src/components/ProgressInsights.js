// src/components/ProgressInsights.js - Hourly / daily / weekly progress overview
import React, { useState, useEffect, useMemo } from 'react';
import { SUMMARY_FIELDS, getColorForValue } from './DaySummaryForm';
import { getLocalDayKey } from '../utils/dateUtils';
import {
  OFFICIAL_START_HOUR,
  OFFICIAL_END_HOUR,
  WORK_SLOTS_PER_HOUR,
  getExpectedDaySlots,
  getExpectedHourSlots,
  getExpectedWeekSlots,
  getWeekStart,
  getWeekDays,
  summarizeBucket,
  formatPercent,
  getScoreStyle
} from '../utils/productivity';
import './ProgressInsights.css';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'trend', label: 'Trend' },
];

const TREND_WEEKS = 8;
const WELLBEING_DAYS = 7;

const ScorePill = ({ score }) => (
  <span className="pi-score" style={getScoreStyle(score)}>{score ?? '–'}</span>
);

const SlotBar = ({ completed, expected, target }) => {
  const denominator = expected || target || completed || 1;
  const ratio = Math.min(1, completed / denominator);
  const color = expected > 0 ? getColorForValue(ratio, 0, 1) : 'var(--stat-off-green-1)';
  return (
    <div className="pi-bar" title={expected > 0 ? `${completed} of ${expected} expected slots` : `${completed} slots (off-time)`}>
      <div className="pi-bar-fill" style={{ width: `${ratio * 100}%`, background: color }} />
      <span className="pi-bar-label">{expected > 0 ? `${completed}/${expected}` : completed}</span>
    </div>
  );
};

const ProgressInsights = ({ isOpen, onClose, stats, daySummaries, now }) => {
  const [activeTab, setActiveTab] = useState('today');

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const data = useMemo(() => {
    if (!isOpen) return null;
    const todayKey = getLocalDayKey(now);
    const weekStart = getWeekStart(now);
    const weekKey = getLocalDayKey(weekStart);

    const today = summarizeBucket(stats.daily[todayKey], getExpectedDaySlots(now, now));
    const week = summarizeBucket(stats.weekly[weekKey], getExpectedWeekSlots(weekStart, now));

    // Hours of today: the official window, widened to include any off-hours work.
    const hoursWithData = Object.keys(stats.hourly)
      .filter(key => key.startsWith(`${todayKey}-`))
      .map(key => parseInt(key.slice(todayKey.length + 1), 10));
    const firstHour = Math.min(OFFICIAL_START_HOUR, ...hoursWithData);
    const lastHour = Math.max(OFFICIAL_END_HOUR - 1, now.getHours(), ...hoursWithData);
    const hours = [];
    for (let h = firstHour; h <= lastHour; h++) {
      const hourDate = new Date(now);
      hourDate.setHours(h, 0, 0, 0);
      hours.push({
        hour: h,
        isCurrent: h === now.getHours(),
        isFuture: h > now.getHours(),
        ...summarizeBucket(stats.hourly[`${todayKey}-${h}`], getExpectedHourSlots(hourDate, now)),
      });
    }

    const days = getWeekDays(weekStart).map(day => {
      const dayKey = getLocalDayKey(day);
      return {
        dayKey,
        date: day,
        isToday: dayKey === todayKey,
        isFuture: dayKey > todayKey,
        summary: daySummaries[dayKey] || null,
        ...summarizeBucket(stats.daily[dayKey], getExpectedDaySlots(day, now)),
      };
    });

    const weeks = Array.from({ length: TREND_WEEKS }, (_, i) => {
      const start = new Date(weekStart);
      start.setDate(start.getDate() - 7 * i);
      const key = getLocalDayKey(start);
      return { key, start, isCurrent: i === 0, ...summarizeBucket(stats.weekly[key], getExpectedWeekSlots(start, now)) };
    });

    // Only weeks with completed work, so weeks before the app was in use don't drag it down.
    const scoredWeeks = weeks.filter(w => w.tasks > 0 && w.score !== null);
    const trendAverage = scoredWeeks.length
      ? Math.round(scoredWeeks.reduce((s, w) => s + w.score, 0) / scoredWeeks.length)
      : null;

    // Wellbeing over the last N days from the day summaries.
    const recentSummaries = Array.from({ length: WELLBEING_DAYS }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      return daySummaries[getLocalDayKey(d)];
    }).filter(Boolean);

    const wellbeing = SUMMARY_FIELDS.map(field => {
      if (field.type === 'toggle') {
        const yes = recentSummaries.filter(s => s[field.id]).length;
        return { field, display: `${yes}/${recentSummaries.length}`, ratio: recentSummaries.length ? yes / recentSummaries.length : null };
      }
      const values = recentSummaries.map(s => s[field.id]).filter(v => typeof v === 'number');
      if (!values.length) return { field, display: '–', ratio: null };
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      return { field, display: avg.toFixed(1), value: avg };
    });

    return { today, week, hours, days, weeks, trendAverage, activeWeeks: scoredWeeks.length, wellbeing, summaryCount: recentSummaries.length };
  }, [isOpen, stats, daySummaries, now]);

  if (!isOpen || !data) return null;

  const formatHour = (h) => `${h % 12 || 12} ${h >= 12 ? 'PM' : 'AM'}`;

  const renderToday = () => (
    <table className="pi-table">
      <thead>
        <tr><th>Hour</th><th>Slots</th><th>😵</th><th>🎯 Est.</th><th>📝 Planned</th><th>Score</th></tr>
      </thead>
      <tbody>
        {data.hours.map(h => (
          <tr key={h.hour} className={`${h.isCurrent ? 'pi-current' : ''} ${h.isFuture ? 'pi-future' : ''}`}>
            <td>{formatHour(h.hour)}</td>
            <td><SlotBar completed={h.completed} expected={h.expected} target={WORK_SLOTS_PER_HOUR} /></td>
            <td>{h.distractions || ''}</td>
            <td>{formatPercent(h.accuracy)}</td>
            <td>{formatPercent(h.planned)}</td>
            <td><ScorePill score={h.score} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderWeek = () => (
    <table className="pi-table">
      <thead>
        <tr><th>Day</th><th>Slots</th><th>Focus</th><th>🎯 Est.</th><th>📝 Planned</th><th>Mood</th><th>Sleep</th><th>Score</th></tr>
      </thead>
      <tbody>
        {data.days.map(d => (
          <tr key={d.dayKey} className={`${d.isToday ? 'pi-current' : ''} ${d.isFuture ? 'pi-future' : ''}`}>
            <td>{d.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}</td>
            <td><SlotBar completed={d.completed} expected={d.expected} /></td>
            <td>{formatPercent(d.focus)}</td>
            <td>{formatPercent(d.accuracy)}</td>
            <td>{formatPercent(d.planned)}</td>
            <td>{d.summary?.moodLevel ?? '–'}</td>
            <td>{d.summary?.sleepHours ?? '–'}</td>
            <td><ScorePill score={d.score} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderTrend = () => (
    <>
      <table className="pi-table">
        <thead>
          <tr><th>Week of</th><th>Slots</th><th>😵</th><th>Focus</th><th>🎯 Est.</th><th>📝 Planned</th><th>Score</th></tr>
        </thead>
        <tbody>
          {data.weeks.map(w => (
            <tr key={w.key} className={w.isCurrent ? 'pi-current' : ''}>
              <td>{w.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</td>
              <td><SlotBar completed={w.completed} expected={w.expected} /></td>
              <td>{w.distractions || ''}</td>
              <td>{formatPercent(w.focus)}</td>
              <td>{formatPercent(w.accuracy)}</td>
              <td>{formatPercent(w.planned)}</td>
              <td><ScorePill score={w.score} /></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4 className="pi-section-title">Wellbeing · last {WELLBEING_DAYS} days ({data.summaryCount} summaries)</h4>
      <div className="pi-wellbeing-grid">
        {data.wellbeing.map(({ field, display, value, ratio }) => {
          let color = 'var(--text-muted)';
          if (value !== undefined) color = getColorForValue(value, field.min, field.max, field.reverseColor);
          else if (ratio !== null && ratio !== undefined) color = getColorForValue(ratio, 0, 1, field.id === 'redFlags');
          return (
            <div className="pi-wellbeing-item" key={field.id}>
              <span className="pi-wellbeing-value" style={{ color }}>{display}</span>
              <span className="pi-wellbeing-label">{field.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="summary-modal-overlay" onClick={onClose}>
      <div className="summary-modal pi-modal" onClick={e => e.stopPropagation()}>
        <div className="summary-modal-header">
          <h3>Progress</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="pi-cards">
          <div className="pi-card">
            <ScorePill score={data.today.score} />
            <span className="pi-card-label">Today</span>
            <span className="pi-card-detail">{data.today.expected > 0 ? `${data.today.completed}/${data.today.expected}` : data.today.completed} slots</span>
          </div>
          <div className="pi-card">
            <ScorePill score={data.week.score} />
            <span className="pi-card-label">This week</span>
            <span className="pi-card-detail">{data.week.completed}/{data.week.expected} slots · focus {formatPercent(data.week.focus)} · est {formatPercent(data.week.accuracy)}</span>
          </div>
          <div className="pi-card">
            <ScorePill score={data.trendAverage} />
            <span className="pi-card-label">{TREND_WEEKS}-week avg</span>
            <span className="pi-card-detail">over {data.activeWeeks} active week{data.activeWeeks === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="toggle-container pi-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`toggle-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'today' && renderToday()}
        {activeTab === 'week' && renderWeek()}
        {activeTab === 'trend' && renderTrend()}

        <p className="pi-footnote">
          Score = 50% slots done vs. expected (weekdays {OFFICIAL_START_HOUR}am–{OFFICIAL_END_HOUR - 12}pm) · 25% focus
          (tasks vs. distractions) · 25% estimate accuracy. “Planned” = task created before the work phase of the hour it was started in.
        </p>
      </div>
    </div>
  );
};

export default ProgressInsights;
