'use client';
import React, {
  useState,
  useEffect,
  useRef,
  FormEvent,
  ChangeEvent,
  RefObject
} from 'react';
import {
  Settings,
  Copy,
  Check,
  Save,
  LogIn,
  Edit2,
  HelpCircle,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Upload
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

/* ------------------------------------------------------------------
   Types & Interfaces
--------------------------------------------------------------------- */

/** Allowed time formats. */
type TimeFormat = '12' | '24';

/** A single log item. */
interface LogItem {
  id: string;
  time: string;
  content: string;
  rawTimestamp?: number;
  date?: string;
}

/** Logs are grouped by date string, e.g. "2025-01-07" => array of logs. */
type LogsByDate = Record<string, LogItem[]>;

/** A single todo item. */
interface TodoItem {
  id: string;
  content: string;
  manualOverride: boolean | null;
  date?: string;
}



/** Todos are grouped by date, e.g. "2025-01-07" => array of todos. */
type TodosByDate = Record<string, TodoItem[]>;

/** Minimal user object. */
interface UserObject {
  username: string;
}

/** State for confirm modal usage. */
interface ConfirmModalState {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/* ------------------------------------------------------------------
   Mock Users & Utilities
--------------------------------------------------------------------- */

const users: Record<string, { password: string }> = {
  admin: { password: 'admin' },
  user: { password: 'user' }
};

/* Generate a unique ID. */
function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id-' + Date.now() + '-' + Math.floor(Math.random() * 1000000);
}

/* Sort logs by their rawTimestamp. */
function sortLogsByTimestamp(logs: LogItem[]): LogItem[] {
  return [...logs].sort((a, b) => {
    const ta = a.rawTimestamp ?? 0;
    const tb = b.rawTimestamp ?? 0;
    return ta - tb;
  });
}

/**
 * Convert all logs from one timezone/format to another, using rawTimestamp as source of truth.
 * This allows consistent "moments" even if the user changes timezones/formats.
 */
function convertAllLogs(
  logData: LogsByDate,
  newTz: string,
  newFormat: TimeFormat
): LogsByDate {
  const updated: LogsByDate = {};
  for (const dateKey of Object.keys(logData)) {
    let dayLogs = logData[dateKey] || [];
    dayLogs = dayLogs.map((log) => {
      if (typeof log.rawTimestamp !== 'number') {
        // older logs might not have rawTimestamp => skip or fallback
        return log;
      }
      const d = new Date(log.rawTimestamp);
      const hour12 = newFormat === '12';
      const newTime = d.toLocaleTimeString('en-US', {
        hour12,
        timeZone: newTz,
        hour: 'numeric',
        minute: '2-digit'
      });
      return { ...log, time: newTime };
    });
    dayLogs = sortLogsByTimestamp(dayLogs);
    updated[dateKey] = dayLogs;
  }
  return updated;
}

/* Word-boundary matching for log vs. todo content. */
function todoMatchesLog(todoContent: string, logContent: string): boolean {
  const escaped = todoContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(logContent);
}

/* ------------------------------------------------------------------
   Confirm Modal
--------------------------------------------------------------------- */
interface ConfirmModalProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white text-black rounded p-6 w-96">
        <p className="text-lg mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Import Modal
--------------------------------------------------------------------- */
interface ImportModalProps {
  type: 'logs' | 'todos';
  isOpen: boolean;
  onClose: () => void;
  onImportConfirm: (items: ParsedItem[]) => void;
  timeFormat: TimeFormat;
  timezone: string;
}

interface ParsedItem {
  id: string;
  date?: string;
  time?: string;
  content: string;
  rawTimestamp?: number;
}

function ImportModal({
  type,
  isOpen,
  onClose,
  onImportConfirm,
  timeFormat,
  timezone
}: ImportModalProps) {
  const [fileContent, setFileContent] = useState<string>('');
  const [textContent, setTextContent] = useState<string>('');
  const [importItems, setImportItems] = useState<ParsedItem[]>([]);
  const [duplicates, setDuplicates] = useState<string[]>([]);
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setFileContent('');
      setTextContent('');
      setImportItems([]);
      setDuplicates([]);
      setSelectedMap({});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result;
      if (typeof content === 'string') {
        setFileContent(content);
      }
    };
    reader.readAsText(file);
  }

  // Helper to parse timePart => [hour, minute]
  function parseTimePart(timeStr: string, fmt: TimeFormat): [number, number] {
    // handle "HH:MM" or "HH:MM AM" or "HH:MM PM"
    const ampmRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
    const m = timeStr.match(ampmRegex);
    if (!m) return [0, 0];
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ampm = (m[3] || '').toUpperCase();

    if (fmt === '12' && ampm) {
      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;
    }
    return [hh, mm];
  }

  function parseLines(rawText: string): ParsedItem[] {
    if (!rawText.trim()) return [];
    const lines = rawText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);

    if (type === 'logs') {
      return lines.map((line) => {
        let datePart = '';
        let timePart = '';
        let contentPart = '';

        // e.g. [YYYY-MM-DD] HH:MM - content
        const dateRegex = /^(\d{4}-\d{2}-\d{2})\s+(.*)$/;
        const match = line.match(dateRegex);
        if (match) {
          datePart = match[1];
          const rest = match[2];
          const segments = rest.split(' - ');
          timePart = segments[0]?.trim() || '';
          contentPart = segments.slice(1).join(' - ').trim();
        } else {
          // no explicit date => just time + content or entire content
          const segments = line.split(' - ');
          if (segments.length > 1) {
            timePart = segments[0]?.trim() || '';
            contentPart = segments.slice(1).join(' - ').trim();
          } else {
            // entire line => treat as content
            const now = new Date();
            timePart = now.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: timeFormat === '12',
              timeZone: timezone
            });
            contentPart = line;
          }
        }

        let rawTimestamp = Date.now();
        try {
          // If datePart is missing, assume "today"
          const dateStr = datePart || new Date().toISOString().slice(0, 10);
          const [hour, minute] = parseTimePart(timePart, timeFormat);
          // use a Date w/ user’s chosen TZ
          const dt = new Date(
            new Date().toLocaleString('en-US', { timeZone: timezone })
          );
          const [yyyy, mm, dd] = dateStr.split('-').map(Number);
          dt.setFullYear(yyyy, mm - 1, dd);
          dt.setHours(hour ?? 0, minute ?? 0, 0, 0);
          rawTimestamp = dt.getTime();
        } catch {
          rawTimestamp = Date.now();
        }

        return {
          id: generateId(),
          date: datePart,
          time: timePart,
          content: contentPart,
          rawTimestamp
        };
      });
    } else {
      // type === 'todos'
      return lines.map((line) => {
        let datePart = '';
        let contentPart = line;
        // e.g. [YYYY-MM-DD] - content
        const dateRegex = /^(\d{4}-\d{2}-\d{2})\s*-\s*(.*)$/;
        const match = line.match(dateRegex);
        if (match) {
          datePart = match[1];
          contentPart = match[2].trim();
        } else {
          if (contentPart.startsWith('-')) {
            contentPart = contentPart.substring(1).trim();
          }
        }
        return {
          id: generateId(),
          date: datePart,
          content: contentPart
        };
      });
    }
  }

  function handleParse() {
    const combined = [fileContent, textContent].filter(Boolean).join('\n');
    if (!combined.trim()) return;

    const linesParsed = parseLines(combined);

    const dedupSet = new Set<string>();
    const finalList: ParsedItem[] = [];
    const dups: string[] = [];

    for (const item of linesParsed) {
      let keyStr = '';
      if (type === 'logs') {
        // deduplicate by rawTimestamp + content
        keyStr = `${item.rawTimestamp}-${item.content}`.toLowerCase();
      } else {
        // deduplicate by date + content
        keyStr = `${item.date}-${item.content}`.toLowerCase();
      }
      if (dedupSet.has(keyStr)) {
        dups.push(item.id);
      } else {
        dedupSet.add(keyStr);
        finalList.push(item);
      }
    }

    setImportItems(finalList);
    setDuplicates(dups);

    // select all by default
    const selMap: Record<string, boolean> = {};
    finalList.forEach((i) => {
      selMap[i.id] = true;
    });
    setSelectedMap(selMap);
  }

  function toggleSelect(id: string) {
    setSelectedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function removePreviewItem(id: string) {
    setImportItems((prev) => prev.filter((x) => x.id !== id));
    setSelectedMap((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    setDuplicates((prev) => prev.filter((d) => d !== id));
  }

  function selectAll() {
    const allSel: Record<string, boolean> = {};
    importItems.forEach((i) => {
      allSel[i.id] = true;
    });
    setSelectedMap(allSel);
  }

  function deselectAll() {
    const allDes: Record<string, boolean> = {};
    importItems.forEach((i) => {
      allDes[i.id] = false;
    });
    setSelectedMap(allDes);
  }

  function handleConfirm() {
    const chosen = importItems.filter((i) => selectedMap[i.id]);
    onImportConfirm(chosen);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white text-black w-[90%] max-w-2xl rounded p-4 relative">
        <h2 className="text-xl font-bold mb-4">
          Import {type === 'logs' ? 'Logs' : 'Todos'}
        </h2>
        <p className="text-sm mb-2">
          {type === 'logs'
            ? 'Format: [YYYY-MM-DD] HH:MM - content or HH:MM - content'
            : 'Format: [YYYY-MM-DD] - content or - content'}
        </p>

        <div className="flex flex-col md:flex-row gap-4 mb-4">
          {/* File + Text Input */}
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">File Input</label>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileChange}
              className="border p-2 w-full mb-2"
            />
            <label className="block text-sm font-medium mb-1">Or Paste Text</label>
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              rows={4}
              className="border w-full p-2 mb-2"
              placeholder={
                type === 'logs'
                  ? '09:30 - Start project\n10:15 - Meeting...'
                  : '- Buy milk\n- Check email...'
              }
            />
            <button
              onClick={handleParse}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Parse
            </button>
          </div>

          {/* Preview */}
          <div className="flex-1">
            <h3 className="font-semibold mb-2">Preview</h3>
            <div className="flex gap-2 mb-2">
              <button
                onClick={selectAll}
                className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Select All
              </button>
              <button
                onClick={deselectAll}
                className="text-sm px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
              >
                Deselect All
              </button>
            </div>

            <div className="max-h-48 overflow-auto border p-2 rounded">
              {importItems.map((item) => {
                const isDup = duplicates.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 mb-1 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedMap[item.id]}
                      onChange={() => toggleSelect(item.id)}
                    />
                    {type === 'logs' ? (
                      <>
                        <span className="font-medium">
                          [{item.date || '(today)'}] {item.time}
                        </span>
                        <span> - {item.content}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">
                          [{item.date || '(today)'}]
                        </span>
                        <span> - {item.content}</span>
                      </>
                    )}
                    {isDup && (
                      <span className="ml-auto text-xs text-red-500">
                        Duplicate
                      </span>
                    )}
                    <button
                      onClick={() => removePreviewItem(item.id)}
                      className="ml-auto text-sm text-gray-600 hover:text-red-600"
                      title="Remove from preview"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
              {importItems.length === 0 && (
                <p className="text-gray-400 text-sm">No parsed items yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Confirm/Cancel */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Main Page
--------------------------------------------------------------------- */

export default function Page(): JSX.Element {
  /* --------------------------------
     Auth State
  ---------------------------------- */
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<UserObject | null>(null);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [alert, setAlert] = useState<{ type: string; message: string } | null>(
    null
  );
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  /* --------------------------------
     Main Data
  ---------------------------------- */
  const [logs, setLogs] = useState<LogsByDate>({});
  const [todos, setTodos] = useState<TodosByDate>({});
  const [newLog, setNewLog] = useState<string>('');
  const [newTodo, setNewTodo] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [timeFormat, setTimeFormat] = useState<TimeFormat>('12');
  const [timezone, setTimezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  // Only two themes: "light" or "dark"
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // UI feedback
  const [showCopyAlert, setShowCopyAlert] = useState<boolean>(false);
  const [showTodosTooltip, setShowTodosTooltip] = useState<boolean>(false);
  const [showLogsTooltip, setShowLogsTooltip] = useState<boolean>(false);

  // Settings modal
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  // Editing logs & todos
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editedTodoContent, setEditedTodoContent] = useState<string>('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editedLogTime, setEditedLogTime] = useState<string>('');
  const [editedLogContent, setEditedLogContent] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Refs for logs so "Jump" can highlight them
  const logRefs = useRef<Record<string, RefObject<HTMLDivElement>>>({});

  // Confirm modal for clearing items
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    visible: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  // Import modals for logs/todos
  const [importLogsOpen, setImportLogsOpen] = useState<boolean>(false);
  const [importTodosOpen, setImportTodosOpen] = useState<boolean>(false);

  // user-specific localStorage key
  const userKey = user ? `timeChapter_${user.username}_` : null;

  /* --------------------------------
     On mount => check if user was remembered
  ---------------------------------- */
  useEffect(() => {
    const savedRemember = localStorage.getItem('timeChapter_rememberMe');
    const savedUser = localStorage.getItem('timeChapter_savedUser');
    if (savedRemember === 'true' && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as UserObject;
        setUser(parsed);
        setIsLoggedIn(true);
      } catch {}
    }
  }, []);

  /* --------------------------------
     Once user is set => load their data
  ---------------------------------- */
  useEffect(() => {
    if (!user || !userKey) return;
    const savedLogs = localStorage.getItem(userKey + 'logs');
    const savedTodos = localStorage.getItem(userKey + 'todos');
    const savedTZ = localStorage.getItem(userKey + 'timezone');
    const savedFormat = localStorage.getItem(userKey + 'timeFormat');
    const savedTheme = localStorage.getItem(userKey + 'theme');
    const savedDate = localStorage.getItem(userKey + 'selectedDate');

    if (savedLogs) setLogs(JSON.parse(savedLogs));
    if (savedTodos) setTodos(JSON.parse(savedTodos));
    if (savedTZ) setTimezone(savedTZ);
    if (savedFormat) setTimeFormat(savedFormat as TimeFormat);
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    if (savedDate) setSelectedDate(savedDate);
  }, [user, userKey]);

  /* --------------------------------
     Save to localStorage whenever data changes
  ---------------------------------- */
  useEffect(() => {
    if (!user || !userKey) return;
    localStorage.setItem(userKey + 'logs', JSON.stringify(logs));
    localStorage.setItem(userKey + 'todos', JSON.stringify(todos));
    localStorage.setItem(userKey + 'timezone', timezone);
    localStorage.setItem(userKey + 'timeFormat', timeFormat);
    localStorage.setItem(userKey + 'theme', theme);
    localStorage.setItem(userKey + 'selectedDate', selectedDate);
  }, [logs, todos, timezone, timeFormat, theme, selectedDate, user, userKey]);

  /* --------------------------------
     Login / Logout
  ---------------------------------- */
  function handleLoginSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!loginUsername.trim() || !loginPassword.trim()) {
      setAlert({ type: 'error', message: 'Please enter username/password' });
      return;
    }
    if (users[loginUsername] && users[loginUsername].password === loginPassword) {
      setUser({ username: loginUsername });
      setIsLoggedIn(true);
      setShowLoginModal(false);
      setAlert(null);

      if (rememberMe) {
        localStorage.setItem('timeChapter_rememberMe', 'true');
        localStorage.setItem(
          'timeChapter_savedUser',
          JSON.stringify({ username: loginUsername })
        );
      } else {
        localStorage.removeItem('timeChapter_rememberMe');
        localStorage.removeItem('timeChapter_savedUser');
      }
    } else {
      setAlert({ type: 'error', message: 'Invalid credentials' });
    }
  }

  function handleLogout() {
    setUser(null);
    setIsLoggedIn(false);
    setLogs({});
    setTodos({});
    localStorage.removeItem('timeChapter_rememberMe');
    localStorage.removeItem('timeChapter_savedUser');
  }

  /* --------------------------------
     Timezone / Time Format changes => re-convert logs
  ---------------------------------- */
  function handleTimezoneChange(newTz: string) {
    const updatedLogs = convertAllLogs(logs, newTz, timeFormat);
    setLogs(updatedLogs);
    setTimezone(newTz);
  }

  function handleTimeFormatChange(newFormat: TimeFormat) {
    const updatedLogs = convertAllLogs(logs, timezone, newFormat);
    setLogs(updatedLogs);
    setTimeFormat(newFormat);
  }

  /* --------------------------------
     Add / Remove / Edit Logs
  ---------------------------------- */
  function addLog() {
    if (!newLog.trim()) return;
    const now = new Date();
    const rawTimestamp = now.getTime();
    const hour12 = timeFormat === '12';
    const timeStr = now.toLocaleTimeString('en-US', {
      hour12,
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit'
    });
    const newLogObj: LogItem = {
      id: generateId(),
      time: timeStr,
      content: newLog,
      rawTimestamp
    };
    const dayLogs = logs[selectedDate] || [];
    const updated = sortLogsByTimestamp([...dayLogs, newLogObj]);
    setLogs({ ...logs, [selectedDate]: updated });
    setNewLog('');
  }

  function removeLog(logId: string) {
    const dayLogs = logs[selectedDate] || [];
    const updated = dayLogs.filter((l) => l.id !== logId);
    setLogs({ ...logs, [selectedDate]: updated });
  }

  function startEditingLog(log: LogItem) {
    setEditingLogId(log.id);
    setEditedLogTime(log.time);
    setEditedLogContent(log.content);
    setEditError(null);
  }

  function parseEditedTime(timeStr: string, fmt: TimeFormat): [number, number] {
    const ampmRegex = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i;
    const m = timeStr.match(ampmRegex);
    if (!m) throw new Error('cannot parse time');
    let hh = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    const ampm = (m[3] || '').toUpperCase();
    if (fmt === '12' && ampm) {
      if (ampm === 'PM' && hh < 12) hh += 12;
      if (ampm === 'AM' && hh === 12) hh = 0;
    }
    return [hh, mm];
  }

  function saveLogEdits(logId: string) {
    const dayLogs = logs[selectedDate] || [];
    const targetLog = dayLogs.find((l) => l.id === logId);
    if (!targetLog) return;

    try {
      // interpret new time in current timezone
      const dt = new Date(
        new Date().toLocaleString('en-US', { timeZone: timezone })
      );
      const [yyyy, mm, dd] = selectedDate.split('-').map(Number);
      dt.setFullYear(yyyy, mm - 1, dd);

      const [hour, minute] = parseEditedTime(editedLogTime, timeFormat);
      dt.setHours(hour, minute, 0, 0);

      const newTS = dt.getTime();
      const hour12 = timeFormat === '12';
      const newTimeStr = dt.toLocaleTimeString('en-US', {
        hour12,
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit'
      });

      const updatedList = dayLogs.map((l) => {
        if (l.id === logId) {
          return {
            ...l,
            time: newTimeStr,
            content: editedLogContent.trim() || l.content,
            rawTimestamp: newTS
          };
        }
        return l;
      });
      const sorted = sortLogsByTimestamp(updatedList);
      setLogs({ ...logs, [selectedDate]: sorted });
    } catch (err) {
      setEditError('Invalid time format');
      return;
    }

    setEditingLogId(null);
    setEditedLogTime('');
    setEditedLogContent('');
    setEditError(null);
  }

  function cancelLogEdit() {
    setEditingLogId(null);
    setEditedLogTime('');
    setEditedLogContent('');
    setEditError(null);
  }

  /* --------------------------------
     Add / Remove / Edit Todos
  ---------------------------------- */
  function addTodo() {
    if (!newTodo.trim()) return;
    const newTodoObj: TodoItem = {
      id: generateId(),
      content: newTodo.trim(),
      manualOverride: null
    };
    const dayTodos = todos[selectedDate] || [];
    const updated = [...dayTodos, newTodoObj];
    setTodos({ ...todos, [selectedDate]: updated });
    setNewTodo('');
  }

  function removeTodo(todoId: string) {
    const dayTodos = todos[selectedDate] || [];
    const updated = dayTodos.filter((t) => t.id !== todoId);
    setTodos({ ...todos, [selectedDate]: updated });
  }

  function startEditingTodo(todo: TodoItem) {
    setEditingTodoId(todo.id);
    setEditedTodoContent(todo.content);
  }

  function saveTodoEdits(todoId: string) {
    const dayTodos = todos[selectedDate] || [];
    const updated = dayTodos.map((t) => {
      if (t.id === todoId) {
        return {
          ...t,
          content: editedTodoContent.trim() || t.content
        };
      }
      return t;
    });
    setTodos({ ...todos, [selectedDate]: updated });
    setEditingTodoId(null);
    setEditedTodoContent('');
  }

  function cancelTodoEdit() {
    setEditingTodoId(null);
    setEditedTodoContent('');
  }

  // Check if a todo is matched from the log
  function getLogMatchState(todo: TodoItem): boolean {
    const dayLogs = logs[selectedDate] || [];
    return dayLogs.some((log) => todoMatchesLog(todo.content, log.content));
  }

  // A user can manually check/uncheck a todo
  function isTodoCompleted(todo: TodoItem): boolean {
    const matched = getLogMatchState(todo);
    if (todo.manualOverride === null) {
      return matched;
    } else {
      return todo.manualOverride;
    }
  }

  function toggleTodo(todo: TodoItem) {
    const dayTodos = todos[selectedDate] || [];
    const updated = dayTodos.map((t) => {
      if (t.id === todo.id) {
        const currentlyCompleted = isTodoCompleted(t);
        return {
          ...t,
          manualOverride: !currentlyCompleted
        };
      }
      return t;
    });
    setTodos({ ...todos, [selectedDate]: updated });
  }

  /* --------------------------------
     Jump => highlight the matched log
  ---------------------------------- */
  function jumpToLog(todo: TodoItem) {
    const matched = getLogMatchState(todo);
    if (!matched) return;

    const dayLogs = logs[selectedDate] || [];
    const matchedLog = dayLogs.find((log) =>
      todoMatchesLog(todo.content, log.content)
    );
    if (!matchedLog) return;

    const logRef = logRefs.current[matchedLog.id];
    if (!logRef || !logRef.current) return;

    // add highlight class
    if (theme === 'dark') {
      logRef.current.classList.add('highlight-dark');
    } else {
      logRef.current.classList.add('highlight-light');
    }
    setTimeout(() => {
      if (theme === 'dark') {
        logRef.current?.classList.remove('highlight-dark');
      } else {
        logRef.current?.classList.remove('highlight-light');
      }
    }, 1500);

    logRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function createLogRef(logId: string): RefObject<HTMLDivElement> {
    if (!logRefs.current[logId]) {
      logRefs.current[logId] = React.createRef<HTMLDivElement>();
    }
    return logRefs.current[logId]!;
  }

  /* --------------------------------
     Copy a todo to the logs (>)
  ---------------------------------- */
  function copyTodoToLog(todo: TodoItem) {
    const now = new Date();
    const rawTimestamp = now.getTime();
    const hour12 = timeFormat === '12';
    const timeStr = now.toLocaleTimeString('en-US', {
      hour12,
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit'
    });
    const dayLogs = logs[selectedDate] || [];
    const newLogObj: LogItem = {
      id: generateId(),
      time: timeStr,
      content: todo.content,
      rawTimestamp
    };
    const updated = sortLogsByTimestamp([...dayLogs, newLogObj]);
    setLogs({ ...logs, [selectedDate]: updated });
  }

  /* --------------------------------
     Copy a log to the todos (<)
  ---------------------------------- */
  function copyLogToTodo(log: LogItem) {
    const dayTodos = todos[selectedDate] || [];
    const newTodoObj: TodoItem = {
      id: generateId(),
      content: log.content,
      manualOverride: null
    };
    setTodos({ ...todos, [selectedDate]: [...dayTodos, newTodoObj] });
  }

  /* --------------------------------
     Import Confirm for Logs/Todos
  ---------------------------------- */
  function handleImportLogsConfirm(items: ParsedItem[]) {
    const updated = { ...logs };
    for (const it of items) {
      const dKey = it.date || selectedDate;
      const dayLogs = updated[dKey] || [];

      const rawTS = it.rawTimestamp ?? Date.now();
      const d = new Date(rawTS);
      const hour12 = timeFormat === '12';
      const newTime = d.toLocaleTimeString('en-US', {
        hour12,
        timeZone: timezone,
        hour: 'numeric',
        minute: '2-digit'
      });

      const newLog: LogItem = {
        id: generateId(),
        rawTimestamp: rawTS,
        time: newTime,
        content: it.content
      };
      updated[dKey] = sortLogsByTimestamp([...dayLogs, newLog]);
    }
    setLogs(updated);
  }

  function handleImportTodosConfirm(items: ParsedItem[]) {
    const updated = { ...todos };
    for (const it of items) {
      const dKey = it.date || selectedDate;
      const dayTodos = updated[dKey] || [];
      const newTodo: TodoItem = {
        id: generateId(),
        content: it.content,
        manualOverride: null
      };
      dayTodos.push(newTodo);
      updated[dKey] = dayTodos;
    }
    setTodos(updated);
  }

  /* --------------------------------
     Export, Copy, Clear
  ---------------------------------- */
  function exportData(type: 'logs' | 'todos') {
    try {
      const data = type === 'logs' ? logs[selectedDate] : todos[selectedDate];
      console.log('Exporting data:', type, 'selectedDate:', selectedDate, 'data:', data);
      
      if (!data?.length) {
        console.warn('No data available to export.');
        return;
      }
  
      const text = type === 'logs'
        ? (data as LogItem[]).map((l) => `${l.time} - ${l.content}`).join('\n')
        : (data as TodoItem[]).map((t) => `- ${t.content}`).join('\n');
      
      console.log('Exporting text:', text);
  
      if (!text) {
        console.warn('Export text is empty.');
        return;
      }
  
      const blob = new Blob([text], { type: 'text/plain' });
      console.log('Blob created:', blob);
      
      if (!blob) {
        console.error('Failed to create Blob.');
        return;
      }
  
      const url = URL.createObjectURL(blob);
      console.log('Object URL created:', url);
      
      if (!url) {
        console.error('Failed to create Object URL.');
        return;
      }
  
      const a = document.createElement('a');
      if (!a) {
        console.error('Failed to create anchor element.');
        return;
      }
  
      a.href = url;
      a.download = `${selectedDate || 'default-date'}-${type}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log('Export successful.');
    } catch (error) {
      console.error('Error in exportData:', error);
    }
  }
  
  
  

  function copyToClipboard(type: 'logs' | 'todos') {
    const data = type === 'logs' ? logs[selectedDate] : todos[selectedDate];
    if (!data?.length) return;
  
    const text = type === 'logs'
      ? (data as LogItem[]).map((l) => `${l.time} - ${l.content}`).join('\n')
      : (data as TodoItem[]).map((t) => `- ${t.content}`).join('\n');
  
    navigator.clipboard.writeText(text).then(() => {
      setShowCopyAlert(true);
      setTimeout(() => setShowCopyAlert(false), 2000);
    });
  }
  

  function confirmClearAll(type: 'logs' | 'todos') {
    setConfirmModal({
      visible: true,
      message: `Are you sure you want to clear all ${type} for ${selectedDate}?`,
      onConfirm: () => {
        if (type === 'logs') {
          setLogs((prev) => ({ ...prev, [selectedDate]: [] }));
        } else {
          setTodos((prev) => ({ ...prev, [selectedDate]: [] }));
        }
        setConfirmModal((s) => ({ ...s, visible: false }));
      },
      onCancel: () => {
        setConfirmModal((s) => ({ ...s, visible: false }));
      }
    });
  }

  /* --------------------------------
     If not logged in => Show Login
  ---------------------------------- */
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-black mb-4">Time Chapter</h1>
        <button
          onClick={() => setShowLoginModal(true)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 flex items-center gap-2"
        >
          <LogIn className="h-5 w-5" />
          Login
        </button>
        {showLoginModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white text-black rounded p-6 w-80">
              <h2 className="text-2xl font-bold mb-4">Login</h2>
              {alert?.type === 'error' && (
                <div className="mb-4 text-red-600 font-medium">
                  {alert.message}
                </div>
              )}
              <form onSubmit={handleLoginSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="admin or user"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-black"
                    placeholder="admin or user"
                  />
                </div>
                <label className="flex items-center space-x-2 mb-6">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="form-checkbox"
                  />
                  <span className="text-sm font-medium">Remember Me</span>
                </label>
                <button
                  type="submit"
                  className="w-full bg-blue-600 text-white rounded p-2 hover:bg-blue-700"
                >
                  Login
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* --------------------------------
     Settings Modal
  ---------------------------------- */
  interface SettingsModalProps {
    onClose: () => void;
  }

  function SettingsModal({ onClose }: SettingsModalProps) {
    const allTZ = Intl.supportedValuesOf
      ? Intl.supportedValuesOf('timeZone')
      : [timezone];

    const [tzSearch, setTzSearch] = useState<string>('');
    const filteredTZ = allTZ.filter((tz) =>
      tz.toLowerCase().includes(tzSearch.toLowerCase())
    );

    const inputClass = theme === 'dark'
      ? 'bg-gray-700 text-gray-100 border-gray-600 placeholder-gray-400 focus:ring-indigo-500 focus:border-indigo-500'
      : 'bg-white text-gray-900 border-gray-300 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500';

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div
          className={
            `rounded p-6 w-80 ` +
            (theme === 'dark'
              ? 'bg-gray-800 text-gray-100'
              : 'bg-white text-gray-900')
          }
        >
          <h2 className="text-xl font-bold mb-4">Settings</h2>

          {/* Theme */}
          <label className="block text-sm font-medium mb-1">Theme</label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
            className={`w-full p-2 border rounded mb-4 ${inputClass}`}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>

          {/* Timezone search */}
          <label className="block text-sm font-medium mb-1">
            Search Timezone
          </label>
          <input
            type="text"
            value={tzSearch}
            onChange={(e) => setTzSearch(e.target.value)}
            className={`w-full p-2 border rounded mb-2 ${inputClass}`}
            placeholder="Type to filter timezones..."
          />

          {/* Single-select Timezone */}
          <label className="block text-sm font-medium mb-1">
            Select Timezone
          </label>
          <select
            value={timezone}
            onChange={(e) => handleTimezoneChange(e.target.value)}
            className={`w-full p-2 border rounded mb-4 ${inputClass}`}
          >
            {filteredTZ.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>

          {/* Time Format */}
          <label className="block text-sm font-medium mb-1">
            Time Format
          </label>
          <select
            value={timeFormat}
            onChange={(e) => handleTimeFormatChange(e.target.value as TimeFormat)}
            className={`w-full p-2 border rounded mb-4 ${inputClass}`}
          >
            <option value="12">12-hour</option>
            <option value="24">24-hour</option>
          </select>

          <button
            onClick={onClose}
            className="w-full bg-blue-500 text-white rounded p-2 hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  /* --------------------------------
     Theming classes
  ---------------------------------- */
  const isDark = theme === 'dark';
  const containerClass = isDark
    ? 'bg-gray-900 text-gray-100 min-h-screen'
    : 'bg-white text-gray-900 min-h-screen';

  const topBarButtonClass = isDark
    ? 'p-2 rounded-full hover:bg-gray-800 text-gray-200'
    : 'p-2 rounded-full hover:bg-gray-100 text-gray-700';

  const dateNavButtonClass = isDark
    ? 'px-4 py-2 bg-gray-800 rounded hover:bg-gray-700 text-gray-100'
    : 'px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-700';

  const cardClass = isDark
    ? 'border border-gray-700 rounded-lg shadow-sm p-4 bg-gray-800 text-gray-100'
    : 'border border-gray-200 rounded-lg shadow-sm p-4 bg-white text-gray-900';

  const iconBtnClass = isDark
    ? 'p-1 hover:bg-gray-700 rounded text-gray-300'
    : 'p-1 hover:bg-gray-200 rounded text-gray-600';

  const timeLabelClass = isDark
    ? 'text-gray-400 mr-2 text-sm'
    : 'text-gray-500 mr-2 text-sm';

  /* --------------------------------
     Render
  ---------------------------------- */
  return (
    <div className={containerClass}>
      {confirmModal.visible && (
        <ConfirmModal
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={confirmModal.onCancel}
        />
      )}
      <ImportModal
        type="logs"
        isOpen={importLogsOpen}
        onClose={() => setImportLogsOpen(false)}
        onImportConfirm={handleImportLogsConfirm}
        timeFormat={timeFormat}
        timezone={timezone}
      />
      <ImportModal
        type="todos"
        isOpen={importTodosOpen}
        onClose={() => setImportTodosOpen(false)}
        onImportConfirm={handleImportTodosConfirm}
        timeFormat={timeFormat}
        timezone={timezone}
      />
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
      {showCopyAlert && (
        <div className="fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded">
          Copied to clipboard!
        </div>
      )}

      {/* You can move these highlight styles into a separate .css file if you prefer */}
      <style jsx global>{`
        .highlight-light {
          background-color: #c7d2fe; /* e.g. indigo-200 */
        }
        .highlight-dark {
          background-color: #4c51bf; /* approx. indigo-700 for better contrast */
        }
      `}</style>

      <div className="max-w-6xl mx-auto p-4">
        {/* Header */}
        <header className="flex flex-col items-center mb-6 relative">
          <h1 className="text-3xl font-bold mb-2">Time Chapter</h1>
          <div className="absolute right-4 top-0 flex gap-2">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className={topBarButtonClass}
              title="Settings"
            >
              <Settings className="h-6 w-6" />
            </button>
            <button
              onClick={handleLogout}
              className={topBarButtonClass}
              title="Logout"
            >
              <LogIn className="h-6 w-6 rotate-180" />
            </button>
          </div>
        </header>

        {/* Calendar Nav */}
        <div className="flex justify-center items-center gap-4 mb-6">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className={dateNavButtonClass}
          >
            ←
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={
              'p-2 border rounded ' +
              (isDark
                ? 'bg-gray-800 text-gray-100 border-gray-700'
                : 'text-gray-900 border-gray-300')
            }
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d.toISOString().split('T')[0]);
            }}
            className={dateNavButtonClass}
          >
            →
          </button>
        </div>

        {/* Grid: Todos (left), Logs (right) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* TODOS */}
          <div className={cardClass}>
            <div className="flex justify-between items-center mb-4 relative">
              <div className="flex items-center gap-2 relative">
                <h2 className="text-xl font-semibold">Todos</h2>
                <div
                  className="relative"
                  onMouseEnter={() => setShowTodosTooltip(true)}
                  onMouseLeave={() => setShowTodosTooltip(false)}
                >
                  <button
                    className={
                      isDark
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }
                    title="Help"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                  {showTodosTooltip && (
                    <div
                      className={
                        `absolute z-10 w-64 p-2 rounded shadow-sm ` +
                        (isDark
                          ? 'bg-gray-800 text-gray-100'
                          : 'bg-gray-200 text-gray-900')
                      }
                      style={{ top: '110%', left: 0 }}
                    >
                      <p className="font-medium">Using Todos</p>
                      <p className="mt-1 text-sm">
                        Write tasks you plan to do. If you create logs containing
                        these words (exact word match), the todo becomes matched.
                        You can manually override by checking/unchecking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Icons row: Import, Trash, Copy, Save */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImportTodosOpen(true)}
                  className={iconBtnClass}
                  title="Import Todos"
                >
                  <Upload className="h-5 w-5" />
                </button>
                <button
                  onClick={() => confirmClearAll('todos')}
                  className={iconBtnClass}
                  title="Clear all todos"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => copyToClipboard('todos')}
                  className={iconBtnClass}
                  title="Copy all todos"
                >
                  <Copy className="h-5 w-5" />
                </button>
                <button
                  onClick={() => exportData('todos')}
                  className={iconBtnClass}
                  title="Save todos"
                >
                  <Save className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Todos list */}
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {(todos[selectedDate] || []).map((todo) => {
                const matched = getLogMatchState(todo);
                const completed = isTodoCompleted(todo);
                return (
                  <div
                    key={todo.id}
                    className={
                      `flex items-center p-2 rounded-lg border ` +
                      (isDark
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-50 border-gray-100') +
                      (completed ? ' opacity-80' : '')
                    }
                  >
                    <input
                      type="checkbox"
                      checked={completed}
                      onChange={() => toggleTodo(todo)}
                      className="mr-2"
                    />
                    {editingTodoId === todo.id ? (
                      <>
                        <input
                          type="text"
                          value={editedTodoContent}
                          onChange={(e) => setEditedTodoContent(e.target.value)}
                          className={
                            `flex-1 p-1 border-b focus:outline-none mr-2 ` +
                            (isDark
                              ? 'bg-gray-600 text-gray-100 border-gray-400'
                              : 'bg-gray-100 text-gray-900 border-gray-300')
                          }
                        />
                        <button
                          onClick={() => saveTodoEdits(todo.id)}
                          className="text-blue-500 font-medium mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelTodoEdit}
                          className="text-gray-500 font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span
                          className={`flex-1 break-all ${
                            completed ? 'line-through' : ''
                          }`}
                        >
                          {todo.content}
                          {completed && (
                            <span className="ml-2 text-green-500">
                              <Check className="h-4 w-4 inline" />
                            </span>
                          )}
                        </span>

                        {matched && completed && (
                          <button
                            onClick={() => jumpToLog(todo)}
                            className={
                              `mr-2 ` +
                              (isDark
                                ? 'hover:bg-gray-600 text-blue-400 p-1 rounded'
                                : 'hover:bg-gray-200 text-blue-600 p-1 rounded')
                            }
                            title="Jump to matching log"
                          >
                            Jump
                          </button>
                        )}

                        <button
                          onClick={() => copyTodoToLog(todo)}
                          className={iconBtnClass + ' mr-2'}
                          title="Add this todo to logs"
                        >
                          <ArrowRight className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => startEditingTodo(todo)}
                          className={iconBtnClass + ' mr-2'}
                          title="Edit Todo"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => removeTodo(todo.id)}
                      className={iconBtnClass}
                      title="Remove Todo"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add new todo */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="Add new todo..."
                className={
                  `flex-1 p-2 border rounded ` +
                  (isDark
                    ? 'bg-gray-700 text-gray-100 border-gray-600'
                    : 'text-gray-900 border-gray-300')
                }
                onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              />
              <button
                onClick={addTodo}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>

          {/* LOGS */}
          <div className={cardClass}>
            <div className="flex justify-between items-center mb-4 relative">
              <div className="flex items-center gap-2 relative">
                <h2 className="text-xl font-semibold">Logs</h2>
                <div
                  className="relative"
                  onMouseEnter={() => setShowLogsTooltip(true)}
                  onMouseLeave={() => setShowLogsTooltip(false)}
                >
                  <button
                    className={
                      isDark
                        ? 'text-gray-400 hover:text-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }
                    title="Help"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </button>
                  {showLogsTooltip && (
                    <div
                      className={
                        `absolute z-10 w-64 p-2 rounded shadow-sm ` +
                        (isDark
                          ? 'bg-gray-800 text-gray-100'
                          : 'bg-gray-200 text-gray-900')
                      }
                      style={{ top: '110%', left: 0 }}
                    >
                      <p className="font-medium">Using Logs</p>
                      <p className="mt-1 text-sm">
                        Document your daily activities. If you have a Todo whose content
                        matches a log (word-boundary), that todo can auto-check
                        (unless overridden).
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Icons row: Import, Trash, Copy, Save */}
              <div className="flex gap-2">
                <button
                  onClick={() => setImportLogsOpen(true)}
                  className={iconBtnClass}
                  title="Import Logs"
                >
                  <Upload className="h-5 w-5" />
                </button>
                <button
                  onClick={() => confirmClearAll('logs')}
                  className={iconBtnClass}
                  title="Clear all logs"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => copyToClipboard('logs')}
                  className={iconBtnClass}
                  title="Copy logs"
                >
                  <Copy className="h-5 w-5" />
                </button>
                <button
                  onClick={() => exportData('logs')}
                  className={iconBtnClass}
                  title="Save logs"
                >
                  <Save className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {(logs[selectedDate] || []).map((log) => {
                // create the ref if missing
                if (!logRefs.current[log.id]) {
                  logRefs.current[log.id] = React.createRef<HTMLDivElement>();
                }
                return (
                  <div
                    key={log.id}
                    ref={logRefs.current[log.id]}
                    className={
                      `flex items-center p-2 rounded-lg border ` +
                      (isDark
                        ? 'bg-gray-700 border-gray-600'
                        : 'bg-gray-50 border-gray-100')
                    }
                  >
                    {editingLogId === log.id ? (
                      <>
                        <div className="flex flex-col flex-1 mr-2">
                          <input
                            type="text"
                            value={editedLogTime}
                            onChange={(e) => setEditedLogTime(e.target.value)}
                            className={
                              `p-1 mb-2 border-b focus:outline-none ` +
                              (isDark
                                ? 'bg-gray-600 text-gray-100 border-gray-400'
                                : 'bg-gray-100 text-gray-900 border-gray-300')
                            }
                            placeholder="e.g. 09:30 or 09:30 AM or 21:30"
                          />
                          <input
                            type="text"
                            value={editedLogContent}
                            onChange={(e) => setEditedLogContent(e.target.value)}
                            className={
                              `p-1 border-b focus:outline-none ` +
                              (isDark
                                ? 'bg-gray-600 text-gray-100 border-gray-400'
                                : 'bg-gray-100 text-gray-900 border-gray-300')
                            }
                            placeholder="Log content..."
                          />
                          {editError && (
                            <div className="text-red-500 text-sm mt-1">
                              {editError}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => saveLogEdits(log.id)}
                          className="text-blue-500 font-medium mr-2"
                        >
                          Save
                        </button>
                        <button
                          onClick={cancelLogEdit}
                          className="text-gray-500 font-medium"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 break-all">
                          <span className={timeLabelClass}>{log.time}</span>
                          <span>{log.content}</span>
                        </div>
                        <button
                          onClick={() => copyLogToTodo(log)}
                          className={iconBtnClass + ' mr-2'}
                          title="Add this log to todos"
                        >
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => startEditingLog(log)}
                          className={iconBtnClass + ' mr-2'}
                          title="Edit Log"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => removeLog(log.id)}
                      className={iconBtnClass}
                      title="Remove Log"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add new log */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newLog}
                onChange={(e) => setNewLog(e.target.value)}
                placeholder="Add new log..."
                className={
                  `flex-1 p-2 border rounded ` +
                  (isDark
                    ? 'bg-gray-700 text-gray-100 border-gray-600'
                    : 'text-gray-900 border-gray-300')
                }
                onKeyDown={(e) => e.key === 'Enter' && addLog()}
              />
              <button
                onClick={addLog}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
