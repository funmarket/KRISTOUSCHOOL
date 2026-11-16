import React, { createContext, useContext } from 'react';

export interface ComponentScenario {
  currentUser: {
    id: string;
    role: 'PARENT';
    accountStatus: 'APPROVED';
    username: string;
    fullName: string;
  };
  messagesStatus: 'ERROR' | 'READY' | 'UNAUTHORIZED' | 'BLOCKED_BACKEND';
  messagesError: string | null;
  messages: Array<{
    id: string;
    subject: string;
    recipientName: string;
    recipientId: string;
    recipientRole: string;
    lastMessage: string;
    unread: boolean;
    updatedAt: string;
    messages: Array<{ id: string; senderId: string; senderName: string; content: string }>;
  }>;
  isHydratingSchoolData: boolean;
}

const ScenarioContext = createContext<ComponentScenario | null>(null);
const t = (key: string) => key;
const refreshSchoolData = async () => undefined;

export function ComponentScenarioProvider({
  scenario,
  children,
}: {
  scenario: ComponentScenario;
  children: React.ReactNode;
}) {
  return <ScenarioContext.Provider value={scenario}>{children}</ScenarioContext.Provider>;
}

// Test-only substitute for the data boundary; MessagesView itself is the real component.
export function useApp() {
  const scenario = useContext(ScenarioContext);
  if (!scenario) throw new Error('Component scenario provider missing');
  return { ...scenario, language: 'en' as const, t, refreshSchoolData };
}
