import { createContext, useContext } from 'react';

/** Whether the intro (components/splash/Intro.tsx) has gone: screens under it shouldn't play their one-off moments while it covers them. */
export const IntroDone = createContext(true);
export const useIntroDone = () => useContext(IntroDone);
