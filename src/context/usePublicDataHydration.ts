import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AdminDirectoryMember,
  BackendOpResult,
  BackendOpStatus,
  CalendarEvent,
  FoodMenuWeek,
  PublicContentEntry,
  SchoolBroadcastItem,
  TeacherDirectoryMember,
} from '../types';
import { MOCK_TEACHERS, MOCK_ADMIN } from '../data/mockData';
import {
  fetchActiveFoodMenu,
  fetchPublicContent,
  listPublicDirectory,
  listSchoolBroadcasts,
  listSchoolCalendarEvents,
} from '../lib/schoolContent';
import { PUBLIC_PREVIEW_FOOD_MENU } from './appContextTypes';

interface UsePublicDataHydrationParams {
  currentUserId?: string | null;
  applyPublicContentResponse: (contentRes: BackendOpResult<Record<string, PublicContentEntry>>) => void;
  onPublicContentHydrationError: (message: string) => void;
}

export function usePublicDataHydration({
  currentUserId,
  applyPublicContentResponse,
  onPublicContentHydrationError,
}: UsePublicDataHydrationParams) {
  const [broadcasts, setBroadcasts] = useState<SchoolBroadcastItem[]>([]);
  const [broadcastsStatus, setBroadcastsStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [broadcastsError, setBroadcastsError] = useState<string | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarStatus, setCalendarStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [foodMenu, setFoodMenu] = useState<FoodMenuWeek>(PUBLIC_PREVIEW_FOOD_MENU);
  const [foodMenuStatus, setFoodMenuStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [foodMenuError, setFoodMenuError] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherDirectoryMember[]>(MOCK_TEACHERS);
  const [admins, setAdmins] = useState<AdminDirectoryMember[]>(MOCK_ADMIN);
  const [directoryStatus, setDirectoryStatus] = useState<BackendOpStatus>('BLOCKED_BACKEND');
  const [directoryError, setDirectoryError] = useState<string | null>(null);

  const mountedRef = useRef<boolean>(true);
  const publicHydrationGenRef = useRef<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const hydratePublicData = useCallback(async (targetUserId?: string | null): Promise<boolean> => {
    const reqGen = ++publicHydrationGenRef.current;
    const effectiveUserId = targetUserId !== undefined ? targetUserId : currentUserId ?? null;

    try {
      const [bRes, calRes, menuRes, dirRes, contentRes] = await Promise.all([
        listSchoolBroadcasts(),
        listSchoolCalendarEvents(effectiveUserId),
        fetchActiveFoodMenu(),
        listPublicDirectory(),
        fetchPublicContent(),
      ]);
      if (!mountedRef.current || reqGen !== publicHydrationGenRef.current) return false;

      setBroadcastsStatus(bRes.status);
      if (bRes.ok && bRes.data) {
        setBroadcasts(bRes.data);
        setBroadcastsError(null);
      } else if (bRes.status === 'UNAUTHORIZED') {
        setBroadcasts([]);
        setBroadcastsError(bRes.errorMessage || bRes.errorCode || 'Unauthorized to load broadcasts.');
      } else if (bRes.status === 'ERROR') {
        setBroadcastsError(bRes.errorMessage || bRes.errorCode || 'Failed to load broadcasts.');
      } else {
        setBroadcastsError(null);
      }

      setCalendarStatus(calRes.status);
      if (calRes.ok && calRes.data) {
        setCalendarEvents(calRes.data);
        setCalendarError(null);
      } else if (calRes.status === 'UNAUTHORIZED') {
        setCalendarEvents([]);
        setCalendarError(calRes.errorMessage || calRes.errorCode || 'Unauthorized to load calendar.');
      } else if (calRes.status === 'BLOCKED_BACKEND') {
        setCalendarEvents([]);
        setCalendarError(null);
      } else if (calRes.status === 'ERROR') {
        setCalendarError(calRes.errorMessage || calRes.errorCode || 'Failed to load calendar events.');
      } else {
        setCalendarError(null);
      }

      setFoodMenuStatus(menuRes.status);
      if (menuRes.ok && menuRes.data) {
        setFoodMenu({ ...menuRes.data, isDemoPreview: false });
        setFoodMenuError(null);
      } else if (menuRes.status === 'READY' && !menuRes.data) {
        setFoodMenu({ id: 'menu-empty', weekRange: '—', published: false, items: [], isDemoPreview: false });
        setFoodMenuError(null);
      } else if (menuRes.status === 'BLOCKED_BACKEND') {
        setFoodMenu(PUBLIC_PREVIEW_FOOD_MENU);
        setFoodMenuError(null);
      } else {
        setFoodMenu({ id: 'menu-error', weekRange: '—', published: false, items: [], isDemoPreview: false });
        setFoodMenuError(menuRes.errorMessage || menuRes.errorCode || 'Failed to load food menu.');
      }

      setDirectoryStatus(dirRes.status);
      if (dirRes.ok && dirRes.data) {
        setTeachers(dirRes.data.teachers);
        setAdmins(dirRes.data.admins);
        setDirectoryError(null);
      } else if (dirRes.status === 'BLOCKED_BACKEND') {
        setTeachers(MOCK_TEACHERS);
        setAdmins(MOCK_ADMIN);
        setDirectoryError(null);
      } else {
        setTeachers([]);
        setAdmins([]);
        setDirectoryError(dirRes.errorMessage || dirRes.errorCode || 'Failed to load directory.');
      }

      applyPublicContentResponse(contentRes);

      return calRes.ok || calRes.status === 'BLOCKED_BACKEND';
    } catch (err) {
      if (!mountedRef.current || reqGen !== publicHydrationGenRef.current) return false;
      const message = err instanceof Error ? err.message : 'Unable to refresh public school data.';
      setCalendarStatus('ERROR');
      setCalendarError(message);
      setBroadcastsStatus('ERROR');
      setBroadcastsError(message);
      onPublicContentHydrationError(message);
      return false;
    }
  }, [applyPublicContentResponse, currentUserId, onPublicContentHydrationError]);

  useEffect(() => {
    void hydratePublicData(currentUserId ?? null);
  }, [hydratePublicData, currentUserId]);

  return {
    broadcasts,
    broadcastsStatus,
    broadcastsError,
    calendarEvents,
    setCalendarEvents,
    calendarStatus,
    calendarError,
    setCalendarError,
    foodMenu,
    foodMenuStatus,
    foodMenuError,
    teachers,
    admins,
    directoryStatus,
    directoryError,
    hydratePublicData,
  };
}
