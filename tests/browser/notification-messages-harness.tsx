import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MessagesView } from '../../src/components/views/MessagesView';
import {
  ComponentScenarioProvider,
  type ComponentScenario,
} from './notification-messages-mock-context';
import type { NotificationTargetIntent } from '../../src/lib/notificationTargetNavigation';

const THREAD_A = '11111111-1111-4111-8111-111111111111';
const THREAD_B = '22222222-2222-4222-8222-222222222222';
const user = (id: string) => ({ id, role: 'PARENT' as const, accountStatus: 'APPROVED' as const, username: id, fullName: id });
const intent = (id: string, actor: string, requestId: number): NotificationTargetIntent => ({
  tab: 'messages', refId: id, actorKey: `${actor}::PARENT::APPROVED`, requestId,
});
const thread = (id: string, label: string) => ({
  id, subject: `Thread ${label}`, recipientName: 'School Teacher', recipientId: 'teacher-1',
  recipientRole: 'TEACHER', lastMessage: `Preview ${label}`, unread: false,
  updatedAt: '2026-11-15T12:00:00Z',
  messages: [{ id: `msg-${label}`, senderId: 'teacher-1', senderName: 'School Teacher', content: `Message ${label} body` }],
});
export const THREADS = { A: thread(THREAD_A, 'A'), B: thread(THREAD_B, 'B') };

type TestState = ComponentScenario & { notificationTarget: NotificationTargetIntent };
declare global {
  interface Window {
    __setMessageScenario: (patch: Partial<TestState>) => void;
    __messageFixtureReady: boolean;
  }
}

const mode = new URLSearchParams(window.location.search).get('initial');
const initial: TestState = {
  currentUser: user('user-a'),
  messagesStatus: mode === 'loading' || mode === 'ready' ? 'READY' : 'ERROR',
  messagesError: mode === 'loading' || mode === 'ready' ? null : 'Temporary network failure',
  messages: mode === 'ready' ? [THREADS.A, THREADS.B] : [],
  isHydratingSchoolData: mode === 'loading',
  notificationTarget: intent(THREAD_A, 'user-a', 1),
};

function Fixture() {
  const [scenario, setScenario] = useState<TestState>(initial);
  useEffect(() => {
    window.__setMessageScenario = (patch) => setScenario((previous) => ({ ...previous, ...patch }));
    window.__messageFixtureReady = true;
    return () => { window.__messageFixtureReady = false; };
  }, []);
  useEffect(() => {
    // Marker is emitted after React commits a scenario, so browser checks do not race state updates.
    document.documentElement.dataset.notificationTestActor = scenario.currentUser.id;
    document.documentElement.dataset.notificationTestRequest = String(scenario.notificationTarget.requestId);
    document.documentElement.dataset.notificationTestStatus = scenario.messagesStatus;
  }, [scenario]);
  return (
    <ComponentScenarioProvider scenario={scenario}>
      <MessagesView notificationTarget={scenario.notificationTarget} />
    </ComponentScenarioProvider>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
