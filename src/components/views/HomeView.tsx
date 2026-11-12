import React from 'react';
import { PublicHomePage, PublicHomePageProps } from '../homepages/PublicHomePage';

/**
 * Legacy HomeView wrapper maintained only as a thin delegate to PublicHomePage.
 * Authenticated role homepages are resolved exclusively through HomePageResolver.
 */
export const HomeView: React.FC<PublicHomePageProps> = (props) => {
  return <PublicHomePage {...props} />;
};
