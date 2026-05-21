import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

const EVENTS_TAB_URL = "https://docs.google.com/spreadsheets/d/1fXMteLyiV2Vld6k3EiFpq4QEblRPqJKaSkBKG0D4TTo/gviz/tq?tqx=out:csv&gid=343677699";
const ENTITY_TAB_URL = "https://docs.google.com/spreadsheets/d/1fXMteLyiV2Vld6k3EiFpq4QEblRPqJKaSkBKG0D4TTo/gviz/tq?tqx=out:csv&gid=1543207625";

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800/90 border border-slate-700/60 px-3 py-2 rounded-lg shadow-xl backdrop-blur-md">
        <p className="text-slate-100 font-semibold text-sm">
          {`${payload[0].name} : `}
          <span className="text-amber-400 font-bold">
            {payload[0].payload.percentage !== undefined ? `${payload[0].payload.percentage}%` : `${payload[0].value} Entities`}
          </span>
        </p>
      </div>
    );
  }
  return null;
};

const parseSheetDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const [datePart, timePart] = dateStr.split(' ');
    const [day, month, year] = datePart.split('/').map(Number);
    if (timePart) {
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
    }
    return new Date(year, month - 1, day);
  } catch (e) {
    return null;
  }
};

const getRelativeTimeString = (lastEventDate, now) => {
  if (!lastEventDate) return "No events recorded";
  
  const diffTime = now.getTime() - lastEventDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return "Just now";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  return `${diffWeeks} weeks ago`;
};

const parseFullCSV = (text) => {
  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(field.trim());
      if (row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length > 0) {
    row.push(field.trim());
    lines.push(row);
  }
  return lines;
};

const parseCSVDataSets = (text, isTracker = false) => {
  const matrix = parseFullCSV(text);
  if (matrix.length === 0) return [];

  if (isTracker) {
    const validEntities = [];
    for (let i = 0; i < matrix.length; i++) {
      const values = matrix[i];
      const entityName = values[3] || "";
      if (entityName && entityName.toLowerCase() !== "licenced entity name" && !entityName.includes("ENTITY TRACKER")) {
        validEntities.push({
          name: entityName.trim(),
          owner: values[4] || "",
          groupId: values[5] || "",
          xps: values[6] || "0",
          strikes: values[7] || "0",
          type: values[10] || "N/A"
        });
      }
    }
    return validEntities;
  } else {
    const headers = (matrix[0] || []).map(h => h.toLowerCase().replace(/:/g, '').trim());
    return matrix.slice(1).map(values => {
      return headers.reduce((obj, nextKey, index) => {
        if (nextKey) {
          obj[nextKey] = (values[index] || "").trim();
        }
        return obj;
      }, {});
    });
  }
};

export default function App() {
  const [eventData, setEventData] = useState([]);
  const [entityData, setEntityData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(120);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [showAllHistory, setShowAllHistory] = useState(false);

  const fetchData = async () => {
    try {
      const cacheBuster = `&t=${new Date().getTime()}`;
      const [eventsRes, entityRes] = await Promise.all([
        fetch(EVENTS_TAB_URL + cacheBuster),
        fetch(ENTITY_TAB_URL + cacheBuster)
      ]);

      const rawEventsText = await eventsRes.text();
      const rawEntityText = await entityRes.text();

      setEventData(parseCSVDataSets(rawEventsText, false));
      setEntityData(parseCSVDataSets(rawEntityText, true));
      
      setLoading(false);
      setCountdown(120);
    } catch (error) {
      console.error("Sheet synchronization drop:", error);
    }
  };

  useEffect(() => {
    fetchData();
    const dataInterval = setInterval(fetchData, 120000);
    const timerInterval = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 120));
    }, 1000);

    return () => {
      clearInterval(dataInterval);
      clearInterval(timerInterval);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a0505] flex flex-col items-center justify-center text-[#fdfcf8] font-mono tracking-widest relative overflow-hidden">
        <img 
          src={`${import.meta.env.BASE_URL}logo1.png`} 
          alt="Watermark Background" 
          className="absolute w-96 h-96 sm:w-[600px] sm:h-[600px] object-contain opacity-5 blur-[1px] select-none pointer-events-none z-0" 
        />
        <div className="flex flex-col items-center gap-4 z-10 bg-[#1a0505]/40 p-6 rounded-2xl backdrop-blur-md border border-red-950/20 shadow-[0_0_25px_rgba(173,40,49,0.25)]">
          <span className="h-7 w-7 border-2 border-t-[#ad2831] border-red-950/40 rounded-full animate-spin" />
          <span className="text-xs sm:text-sm font-black text-red-200 tracking-widest animate-pulse text-center">
            LOADING ENTITY DASHBOARD...
          </span>
        </div>
      </div>
    );
  }

  const validEvents = eventData.filter(row => {
    const formType = row["type of form"] || row["form type"] || "";
    const eventType = row["event type"] || row["type of event"] || "";
    return formType.toLowerCase().includes("event logging") && eventType.length > 0;
  });
  
  const totalEventsCount = validEvents.length;

  const typeStatsMap = {};
  const weeklyHosterMap = {};
  const weeklyEntityMap = {};
  const attendeeAttendanceMap = {};
  let totalWeeklyEventsCount = 0;

  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const distinctEntityTypes = ["All", ...new Set(entityData.map(e => e.type).filter(Boolean))];

  let retainedCount = 0;
  let earlyDecayCount = 0;
  let advancedDecayCount = 0;
  let churnedCount = 0;

  const enhancedEntities = entityData.map(entity => {
    let totalAttendeesForEntity = 0;
    let currentWeekEventsCount = 0;
    let previousWeekEventsCount = 0;
    let totalEventsForEntity = 0;
    let latestEventDate = null;
    
    const trackingNameClean = entity.name.toLowerCase().replace(/[^a-z0-9]/g, '');

    validEvents.forEach(row => {
      const logEntityRaw = row["entity name"] || row["entity"] || "";
      const logEntityClean = logEntityRaw.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (logEntityClean.length > 0 && trackingNameClean.length > 0 && 
         (logEntityClean.includes(trackingNameClean) || trackingNameClean.includes(logEntityClean))) {
        
        totalEventsForEntity += 1;
        
        const logDate = parseSheetDate(row["timestamp"]);
        if (logDate) {
          if (!latestEventDate || logDate > latestEventDate) {
            latestEventDate = logDate;
          }

          if (logDate >= oneWeekAgo && logDate <= now) {
            currentWeekEventsCount += 1;
            weeklyEntityMap[entity.name] = (weeklyEntityMap[entity.name] || 0) + 1;
          } else if (logDate >= twoWeeksAgo && logDate < oneWeekAgo) {
            previousWeekEventsCount += 1;
          }
        }

        const rawAttendance = row["usernames of attendees"] || row["attendees"] || "";
        if (rawAttendance && rawAttendance.toLowerCase() !== "n/a") {
          const usernames = rawAttendance.split(/[,\s;]+/).map(u => u.trim()).filter(u => u.length > 1);
          totalAttendeesForEntity += usernames.length;
        }
      }
    });

    const avgAttendance = totalEventsForEntity > 0 
      ? (totalAttendeesForEntity / totalEventsForEntity).toFixed(1) 
      : "0.0";

    let lifecycleStatus = "Active";
    let lifecycleColor = "text-emerald-400 bg-emerald-950/20 border-emerald-800/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
    
    if (!latestEventDate) {
      lifecycleStatus = "Inactive";
      lifecycleColor = "text-rose-500 bg-rose-950/20 border-rose-900/40 shadow-[0_0_8px_rgba(244,63,94,0.15)]";
      churnedCount++;
    } else if (latestEventDate >= oneWeekAgo) {
      lifecycleStatus = "Active";
      lifecycleColor = "text-emerald-400 bg-emerald-950/20 border-emerald-800/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]";
      retainedCount++;
    } else if (latestEventDate >= twoWeeksAgo) {
      lifecycleStatus = "Early Inactivity";
      lifecycleColor = "text-amber-400 bg-amber-950/20 border-amber-800/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]";
      earlyDecayCount++;
    } else if (latestEventDate >= oneMonthAgo) {
      lifecycleStatus = "Severe Inactivity";
      lifecycleColor = "text-orange-500 bg-orange-950/20 border-orange-900/40 shadow-[0_0_8px_rgba(249,115,22,0.15)]";
      advancedDecayCount++;
    } else {
      lifecycleStatus = "Inactive";
      lifecycleColor = "text-rose-500 bg-rose-950/20 border-rose-900/40 shadow-[0_0_8px_rgba(244,63,94,0.15)]";
      churnedCount++;
    }

    let trendColorClass = "border-amber-500/25 outline-amber-500/5 shadow-[0_0_12px_rgba(245,158,11,0.18)]"; 
    let trendIndicatorText = "↔ No change this week";

    if (currentWeekEventsCount > previousWeekEventsCount) {
      trendColorClass = "border-emerald-500/45 outline-emerald-500/15 ring-1 ring-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.28)]"; 
      trendIndicatorText = `▲ +${currentWeekEventsCount - previousWeekEventsCount} events vs last week`;
    } else if (currentWeekEventsCount < previousWeekEventsCount) {
      trendColorClass = "border-rose-600/45 outline-rose-600/15 ring-1 ring-rose-600/5 shadow-[0_0_15px_rgba(225,29,72,0.28)]"; 
      trendIndicatorText = `▼ -${previousWeekEventsCount - currentWeekEventsCount} events vs last week`;
    }

    const lastEventElapsedText = getRelativeTimeString(latestEventDate, now);

    return {
      ...entity,
      avgAttendance,
      totalEventsForEntity,
      currentWeekEventsCount,
      trendColorClass,
      trendIndicatorText,
      lastEventElapsedText,
      lifecycleStatus,
      lifecycleColor
    };
  });

  const filteredEntities = enhancedEntities.filter(entity => {
    const cleanSearch = searchTerm.toLowerCase();
    const matchesSearch = entity.name.toLowerCase().includes(cleanSearch) || 
                          entity.owner.toLowerCase().includes(cleanSearch);
    const matchesType = selectedType === "All" || entity.type === selectedType;
    return matchesSearch && matchesType;
  });

  validEvents.forEach(row => {
    const type = row["event type"] || row["type of event"] || "";
    const rawAttendance = row["usernames of attendees"] || row["attendees"] || "";
    const hosterName = row["username"] || row["host"] || row["hosted by"] || "Unknown Hoster";
    
    const parsedDate = parseSheetDate(row["timestamp"]);
    if (parsedDate) {
      const dayIndex = parsedDate.getDay();
      weekdayCounts[dayIndex] += 1;

      if (parsedDate >= oneWeekAgo && parsedDate <= now) {
        weeklyHosterMap[hosterName] = (weeklyHosterMap[hosterName] || 0) + 1;
        totalWeeklyEventsCount += 1;
      }
    }

    let attendeeCount = 0;
    if (rawAttendance && rawAttendance.toLowerCase() !== "n/a") {
      const usernames = rawAttendance.split(/[,\s;]+/).map(u => u.trim()).filter(u => u.length > 1);
      attendeeCount = usernames.length;
      
      usernames.forEach(username => {
        attendeeAttendanceMap[username] = (attendeeAttendanceMap[username] || 0) + 1;
      });
    }

    if (type) {
      if (!typeStatsMap[type]) {
        typeStatsMap[type] = { occurrences: 0, totalAttendees: 0 };
      }
      typeStatsMap[type].occurrences += 1;
      typeStatsMap[type].totalAttendees += attendeeCount;
    }
  });

  const weeklyHostLeaderboard = Object.entries(weeklyHosterMap)
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count);

  const weeklyEntityLeaderboard = Object.entries(weeklyEntityMap)
    .map(([entityName, count]) => ({ entityName, count }))
    .sort((a, b) => b.count - a.count);

  const globalAttendeesLeaderboard = Object.entries(attendeeAttendanceMap)
    .map(([username, count]) => ({ username, count }))
    .sort((a, b) => b.count - a.count);

  const topWeeklyHoster = weeklyHostLeaderboard[0] || { username: "None", count: 0 };
  const topWeeklyEntity = weeklyEntityLeaderboard[0] || { entityName: "None", count: 0 };

  const topHosterPercentage = totalWeeklyEventsCount > 0 
    ? ((topWeeklyHoster.count / totalWeeklyEventsCount) * 100).toFixed(1) 
    : "0.0";

  const topEntityPercentage = totalWeeklyEventsCount > 0 
    ? ((topWeeklyEntity.count / totalWeeklyEventsCount) * 100).toFixed(1) 
    : "0.0";

  const dayDistributionData = weekdayNames.map((name, idx) => {
    const count = weekdayCounts[idx];
    const percentage = totalEventsCount > 0 ? ((count / totalEventsCount) * 100).toFixed(1) : "0.0";
    return { name, count, percentage };
  });

  const COLORS = ['#ad2831', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  const pieChartData = Object.keys(typeStatsMap).map((type, idx) => ({
    name: type,
    value: typeStatsMap[type].occurrences,
    percentage: totalEventsCount > 0 ? Number(((typeStatsMap[type].occurrences / totalEventsCount) * 100).toFixed(1)) : 0,
    color: COLORS[idx % COLORS.length]
  }));

  const retentionChartData = [
    { name: 'Active', value: retainedCount, color: '#10b981' },
    { name: 'Early Inactivity', value: earlyDecayCount, color: '#f59e0b' },
    { name: 'Severe Inactivity', value: advancedDecayCount, color: '#f97316' },
    { name: 'Inactive', value: churnedCount, color: '#ef4444' }
  ];

  let modalEvent = "N/A";
  let maxCount = 0;
  Object.entries(typeStatsMap).forEach(([type, stats]) => {
    if (stats.occurrences > maxCount) {
      maxCount = stats.occurrences;
      modalEvent = type;
    }
  });

  const averageAttendanceCards = Object.entries(typeStatsMap).map(([type, stats]) => ({
    type,
    avg: stats.occurrences > 0 ? (stats.totalAttendees / stats.occurrences).toFixed(1) : "0.0",
    totalEvents: stats.occurrences
  }));

  const timelineMap = {};
  validEvents.forEach(row => {
    const rawTimestamp = row["timestamp"] || "";
    const parsedDate = parseSheetDate(rawTimestamp);
    
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      const y = parsedDate.getFullYear();
      const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
      const d = String(parsedDate.getDate()).padStart(2, '0');
      const stdKey = `${y}-${m}-${d}`;
      
      if (!timelineMap[stdKey]) {
        timelineMap[stdKey] = {
          count: 0,
          displayLabel: `${d}/${m}/${y}`,
          timestamp: parsedDate.getTime()
        };
      }
      timelineMap[stdKey].count += 1;
    }
  });

  const fullLineGraphData = Object.entries(timelineMap)
    .map(([stdKey, info]) => ({
      date: info.displayLabel,
      events: info.count,
      timestamp: info.timestamp
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const displayedLineGraphData = showAllHistory ? fullLineGraphData : fullLineGraphData.slice(-14);

  return (
    <div className="min-h-screen bg-[#1a0505] text-[#fdfcf8] p-6 font-sans relative overflow-hidden">
      
      {/* Central Background Watermark Layer - Expanded Size and Enhanced Baseline Opacity */}
      <img 
        src={`${import.meta.env.BASE_URL}logo1.png`} 
        alt="Main Screen Watermark" 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] sm:w-[800px] sm:h-[800px] object-contain opacity-[0.12] blur-[0.5px] select-none pointer-events-none z-0" 
      />

      <div className="relative z-10">
        
        {/* Header Module */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 border-b border-red-900/40 pb-5">
          <div className="min-w-[250px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ad2831] animate-pulse" />
              <h1 className="text-2xl font-black tracking-wider text-white uppercase">Entity Statistical Dashboard</h1>
            </div>
            <p className="text-xs text-red-300 mt-1">Ministry Of Labour, Labour Adminstration Bureau</p>
            <p className="text-[9px] text-slate-400 mt-1.5 tracking-wide italic">
              Credits: Senior Labour Officer, President1327
            </p>
          </div>

          <div className="flex justify-center items-center gap-5 my-2 sm:my-0">
            <img src={`${import.meta.env.BASE_URL}logo1.png`} alt="Logo 1" className="h-14 w-14 object-contain opacity-90" />
            <div className="h-8 w-[1.5px] bg-white/15 self-center" />
            <img src={`${import.meta.env.BASE_URL}logo2.png`} alt="Logo 2" className="h-14 w-14 object-contain opacity-90" />
          </div>

          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 px-4 py-2 rounded-xl flex items-center justify-between sm:justify-end gap-4 min-w-[220px] shadow-[0_0_15px_rgba(173,40,49,0.2)]">
            <span className="text-xs font-mono text-red-400 uppercase tracking-widest">Next Dashboard Update In:</span>
            <span className="text-sm font-mono font-bold text-[#fdfcf8] bg-[#1a0505]/45 px-2.5 py-0.5 rounded border border-red-900/30">{countdown}s</span>
          </div>
        </div>

        {/* Global Metric Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-6">
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl shadow-[0_0_15px_rgba(173,40,49,0.22)]">
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider block">Logged Events (All-Time)</span>
            <p className="text-4xl font-black text-white mt-1">{totalEventsCount}</p>
          </div>
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl shadow-[0_0_15px_rgba(173,40,49,0.22)]">
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider block">Modal Event Type</span>
            <p className="text-xl font-black text-amber-400 mt-2 truncate">{modalEvent}</p>
            <span className="text-[10px] text-red-400 block mt-0.5">Most Event Hosted</span>
          </div>
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl shadow-[0_0_15px_rgba(173,40,49,0.22)]">
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider block">TOTAL EVENT VARIANTS</span>
            <p className="text-4xl font-black text-blue-400 mt-1">{Object.keys(typeStatsMap).length}</p>
          </div>
        </div>

        {/* Tactical Spotlight Leaderboard Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
          <div className="bg-[#2d080d]/40 backdrop-blur-md border-2 border-amber-500/20 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden shadow-[0_0_25px_rgba(245,158,11,0.25)]">
            <div className="absolute top-0 right-0 p-8 text-6xl text-amber-500/5 font-black uppercase pointer-events-none select-none font-mono">HOST</div>
            <div className="flex-1 min-w-0 pr-4">
              <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest font-mono">🥇 Weekly Top Hoster</span>
              <p className="text-xl font-black text-white mt-2 font-mono truncate" title={topWeeklyHoster.username}>{topWeeklyHoster.username}</p>
              <p className="text-xs text-amber-500/90 font-mono mt-1 font-semibold">
                 {topHosterPercentage}% of all events this week come from {topWeeklyHoster.username}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-3xl font-black text-amber-400 font-mono">{topWeeklyHoster.count}</span>
              <span className="text-[10px] block text-red-400 font-mono uppercase font-bold">Events Hosted</span>
            </div>
          </div>

          <div className="bg-[#2d080d]/40 backdrop-blur-md border-2 border-blue-500/20 p-5 rounded-2xl flex items-center justify-between relative overflow-hidden shadow-[0_0_25px_rgba(59,130,246,0.25)]">
            <div className="absolute top-0 right-0 p-8 text-6xl text-blue-500/5 font-black uppercase pointer-events-none select-none font-mono">ENTITY</div>
            <div className="flex-1 min-w-0 pr-4">
              <span className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest font-mono">🏆 Weekly Top Entity</span>
              <p className="text-xl font-black text-white mt-2 font-mono truncate" title={topWeeklyEntity.entityName}>{topWeeklyEntity.entityName}</p>
              <p className="text-xs text-blue-400 font-mono mt-1 font-semibold">
                 {topEntityPercentage}% of all events this week come from {topWeeklyEntity.entityName}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-3xl font-black text-blue-400 font-mono">{topWeeklyEntity.count}</span>
              <span className="text-[10px] block text-red-400 font-mono uppercase font-bold">Logs Recorded</span>
            </div>
          </div>
        </div>

        {/* Turnout Averages Module */}
        <div className="mb-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-red-300 mb-3">Average Attendance Per Event Variant</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {averageAttendanceCards.map((item, idx) => (
              <div key={idx} className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/35 p-4 rounded-xl relative overflow-hidden flex flex-col justify-between shadow-[0_0_12px_rgba(173,40,49,0.18)]">
                <div className="absolute top-0 left-0 w-1 h-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-[11px] font-bold text-red-200 block truncate uppercase pr-1" title={item.type}>{item.type}</span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-white font-mono">{item.avg}</span>
                  <span className="text-[10px] text-red-400 font-medium">avg attendees</span>
                </div>
                <span className="text-[10px] text-red-400 font-mono mt-0.5 block">Sample size: {item.totalEvents} events</span>
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Operational Chart Layout */}
        <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl mb-6 shadow-[0_0_20px_rgba(173,40,49,0.25)]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-200">Historical Event Frequency</h3>
            <div className="flex gap-1.5 bg-[#1a0505]/45 p-1 border border-red-900/30 rounded-xl font-mono text-[10px] shadow-[0_0_8px_rgba(173,40,49,0.15)]">
              <button onClick={() => setShowAllHistory(false)} className={`px-3 py-1 rounded-lg font-bold uppercase ${!showAllHistory ? 'bg-[#ad2831]/70 text-white' : 'text-red-400'}`}>Recent (14d)</button>
              <button onClick={() => setShowAllHistory(true)} className={`px-3 py-1 rounded-lg font-bold uppercase ${showAllHistory ? 'bg-[#ad2831]/70 text-white' : 'text-red-400'}`}>All Time</button>
            </div>
          </div>
          <div className="h-44 w-full">
            {displayedLineGraphData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart 
                  data={displayedLineGraphData} 
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="eventGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ad2831" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#ad2831" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#4c1116" opacity={0.2} vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#fdfcf8" 
                    tick={{ fill: '#fdfcf8', opacity: 0.5 }}
                    style={{ fontSize: '10px', fontFamily: 'monospace' }} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#fdfcf8" 
                    tick={{ fill: '#fdfcf8', opacity: 0.5 }}
                    style={{ fontSize: '10px', fontFamily: 'monospace' }} 
                    dx={-5}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(26,5,5,0.85)', borderColor: '#ad2831', color: '#fdfcf8', borderRadius: '8px', fontFamily: 'monospace' }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="events" 
                    stroke="#ad2831" 
                    strokeWidth={2} 
                    fillOpacity={1} 
                    fill="url(#eventGlow)" 
                    dot={{ fill: '#ad2831', stroke: '#2d080d', strokeWidth: 1.5, r: 4 }}
                    activeDot={{ r: 6, stroke: '#fdfcf8', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-red-400 italic">Compiling historical timeline matrix...</div>
            )}
          </div>
        </div>

        {/* Weekday Distribution Grid */}
        <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl mb-6 shadow-[0_0_20px_rgba(173,40,49,0.25)]">
          <h3 className="text-sm font-bold uppercase tracking-wider text-red-200 mb-3">Events Distribution Across The Week</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {dayDistributionData.map((day, idx) => (
              <div key={idx} className="bg-[#1a0505]/45 border border-red-900/30 p-3 rounded-xl text-center flex flex-col justify-between shadow-[0_0_10px_rgba(173,40,49,0.15)]">
                <span className="text-[11px] font-mono tracking-wider font-bold text-red-300 uppercase">{day.name}</span>
                <div className="my-2">
                  <span className="text-2xl font-black text-amber-400 font-mono">{day.percentage}%</span>
                </div>
                <span className="text-[10px] text-red-400 font-mono">{day.count} total events</span>
              </div>
            ))}
          </div>
        </div>

        {/* Lower Main Quad-Column System Workspace */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Workspace 1: Analytical Proportions */}
          <div className="grid grid-cols-1 gap-4 h-[450px]">
            {/* Top Pie Proportion Chart */}
            <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-4 rounded-2xl flex items-center justify-between h-[218px] shadow-[0_0_15px_rgba(173,40,49,0.2)]">
              <div className="w-[45%] flex flex-col justify-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-200">Event Breakdown</h3>
                <p className="text-[9px] text-red-400 mt-0.5">Based on the percentage of all events.</p>
                <div className="mt-3 space-y-1 max-h-24 overflow-y-auto pr-1 text-[9px]">
                  {pieChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-red-300 truncate">{item.name}: {item.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-[55%] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie data={pieChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45}>
                      {pieChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Entity Health Proportions */}
            <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-4 rounded-2xl flex items-center justify-between h-[218px] shadow-[0_0_15px_rgba(173,40,49,0.2)]">
              <div className="w-[45%] flex flex-col justify-center">
                <h3 className="text-xs font-bold uppercase tracking-wider text-red-200">Entity Activity</h3>
                <p className="text-[9px] text-red-400 mt-0.5">Based on the licensed entity cards.</p>
                <div className="mt-3 space-y-1 max-h-24 overflow-y-auto pr-1 text-[9px]">
                  {retentionChartData.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-1 truncate">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-red-300 truncate">{item.name}:</span>
                      <span className="text-white font-bold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-[55%] h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<CustomTooltip />} />
                    <Pie data={retentionChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={45}>
                      {retentionChartData.map((entry, idx) => <Cell key={`cell-${idx}`} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Workspace 2: Licensed Registry Ledger */}
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl h-[450px] flex flex-col shadow-[0_0_20px_rgba(173,40,49,0.25)]">
            <div className="mb-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-red-200 mb-2">Licenced Entities ({filteredEntities.length})</h3>
              <div className="flex flex-col gap-2">
                <input type="text" placeholder="Search Entity / Owner..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#1a0505]/45 border border-red-900/40 text-xs px-3 py-2 rounded-xl text-white placeholder-red-800/60 focus:outline-none shadow-[0_0_8px_rgba(173,40,49,0.15)]" />
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full bg-[#1a0505]/45 border border-red-900/40 text-xs px-2 py-2 rounded-xl text-red-300 focus:outline-none font-mono cursor-pointer shadow-[0_0_8px_rgba(173,40,49,0.15)]">
                  {distinctEntityTypes.map((type, idx) => <option key={idx} value={type}>{type}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 overflow-y-auto pr-1 flex-1">
              {filteredEntities.length > 0 ? (
                filteredEntities.map((entity, index) => (
                  <div key={index} className={`bg-[#1a0505]/55 border outline p-3.5 rounded-xl transition-all duration-300 ${entity.trendColorClass}`}>
                    <div className="flex justify-between items-start gap-2 mb-1.5">
                      <h4 className="font-bold text-white text-xs truncate tracking-wide">{entity.name}</h4>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-[#2d080d]/60 border border-red-900/40 text-red-300 flex-shrink-0">
                        {entity.type}
                      </span>
                    </div>
                    
                    <div className="text-[10px] space-y-0.5 mb-2">
                      <p className="text-red-400 truncate">Owner: <span className="text-red-200 font-mono">{entity.owner}</span></p>
                      <p className="text-red-400">
                        Time Since Last Event: <span className="text-amber-400 font-semibold font-mono">{entity.lastEventElapsedText}</span>
                      </p>
                      <div className="pt-1.5">
                        <span className={`px-2 py-0.5 border text-[9px] font-mono rounded-md font-semibold tracking-wide ${entity.lifecycleColor}`}>
                          {entity.lifecycleStatus}
                        </span>
                      </div>
                    </div>

                    <div className="text-[9px] font-bold font-mono tracking-wide mb-2 uppercase opacity-90">
                      <span className={entity.trendColorClass.includes('emerald') ? 'text-emerald-400' : entity.trendColorClass.includes('rose') ? 'text-rose-500' : 'text-amber-400'}>
                        {entity.trendIndicatorText}
                      </span>
                    </div>
                    
                    <div className="bg-[#2d080d]/25 border border-red-900/30 rounded-lg p-2 mb-2.5 flex justify-between items-center text-center text-[10px] font-mono">
                      <div className="text-left">
                        <span className="text-red-400 block uppercase text-[8px]">7-Day Events</span>
                        <span className="text-emerald-400 font-bold text-xs">{entity.currentWeekEventsCount} events</span>
                      </div>
                      <div className="text-right">
                        <span className="text-red-400 block uppercase text-[8px]">Total Events</span>
                        <span className="text-red-200 text-xs font-bold">{entity.totalEventsForEntity} events</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                      <div className="bg-[#2d080d]/40 p-1.5 rounded border border-red-900/30 flex justify-between px-2 items-center">
                        <span className="text-red-400 uppercase text-[9px]">Avg Att:</span>
                        <span className="font-bold font-mono text-red-200">{entity.avgAttendance}</span>
                      </div>
                      <div className="bg-[#2d080d]/40 p-1.5 rounded border border-red-900/30 flex justify-between px-2 items-center">
                        <span className="text-red-400 uppercase text-[9px]">Strikes:</span>
                        <span className={`font-bold font-mono ${parseFloat(entity.strikes) > 0 ? 'text-amber-500' : 'text-red-400'}`}>{entity.strikes}</span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-red-400 italic mt-8">No entities match your active filter inputs...</div>
              )}
            </div>
          </div>

          {/* Workspace 3: Internal Live Activity Records */}
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-4 rounded-2xl h-[450px] flex flex-col gap-4 shadow-[0_0_20px_rgba(173,40,49,0.25)]">
            <div className="flex flex-col h-[50%]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-200 mb-2">Weekly Top Hosters</h3>
              <div className="overflow-y-auto pr-1 flex-1 font-mono text-[11px] space-y-1">
                {weeklyHostLeaderboard.length > 0 ? (
                  weeklyHostLeaderboard.slice(0, 10).map((user, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#1a0505]/45 border border-red-900/30 p-1.5 rounded-lg shadow-[0_0_8px_rgba(173,40,49,0.12)]">
                      <span className="text-red-100 truncate">{idx + 1}. {user.username}</span>
                      <span className="text-amber-400 font-bold bg-amber-950/10 px-1.5 py-0.5 rounded text-[10px]">{user.count} events</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-red-400/60 italic p-2 text-center">No host operations tracked this week.</div>
                )}
              </div>
            </div>

            <div className="flex flex-col h-[50%] border-t border-red-900/30 pt-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-red-200 mb-2">Weekly Active Entities</h3>
              <div className="overflow-y-auto pr-1 flex-1 font-mono text-[11px] space-y-1">
                {weeklyEntityLeaderboard.length > 0 ? (
                  weeklyEntityLeaderboard.slice(0, 10).map((entity, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#1a0505]/45 border border-red-900/30 p-1.5 rounded-lg shadow-[0_0_8px_rgba(173,40,49,0.12)]">
                      <span className="text-red-100 truncate">{idx + 1}. {entity.entityName}</span>
                      <span className="text-blue-400 font-bold bg-blue-950/10 px-1.5 py-0.5 rounded text-[10px]">{entity.count} logs</span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-red-400/60 italic p-2 text-center">No active entity sessions this week.</div>
                )}
              </div>
            </div>
          </div>

          {/* Workspace 4: Attendee Turnout Metrics */}
          <div className="bg-[#2d080d]/40 backdrop-blur-md border border-red-900/40 p-5 rounded-2xl h-[450px] flex flex-col shadow-[0_0_20px_rgba(173,40,49,0.25)]">
            <h3 className="text-sm font-bold uppercase tracking-wider text-red-200 mb-3">Top Attending Attendees</h3>
            <div className="grid grid-cols-1 gap-2 overflow-y-auto pr-1 flex-1 font-mono text-xs">
              {globalAttendeesLeaderboard.length > 0 ? (
                globalAttendeesLeaderboard.slice(0, 10).map((attendee, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#1a0505]/45 border border-red-900/30 p-2.5 rounded-xl shadow-[0_0_8px_rgba(173,40,49,0.12)]">
                    <span className="text-slate-200 truncate">{idx + 1}. {attendee.username}</span>
                    <span className="text-red-400 font-bold text-[10px] bg-red-950/10 px-2 py-0.5 rounded-md border border-red-900/40">
                      {attendee.count} EVENTS
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-center text-xs text-red-400 italic mt-8">No user attendance metrics compiled...</div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}