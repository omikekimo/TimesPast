
import React, { useState, useEffect, useContext } from "react";
import { useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Globe, Moon, Sun, Map as MapIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { MapPageContext } from "@/components/context/MapPageContext";
import { LayoutContext } from "@/components/context/LayoutContext";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sidebarControls, setSidebarControls] = useState(null);
  const mapPageContext = useContext(MapPageContext);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('timesPastDarkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored ? JSON.parse(stored) : prefersDark;

    setIsDarkMode(shouldBeDark);
    document.documentElement.classList.toggle('dark', shouldBeDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('timesPastDarkMode', JSON.stringify(newMode));
    document.documentElement.classList.toggle('dark', newMode);
  };

  const isMapPage = location.pathname === createPageUrl("Map");

  return (
    <LayoutContext.Provider value={{ setSidebarControls }}>
      <SidebarProvider>
        <style>{`
          :root {
            --primary-navy: #1e293b;
            --primary-gold: #f59e0b;
            --accent-blue: #3b82f6;
            --soft-gray: #f8fafc;
            --text-primary: #0f172a;
            --text-secondary: #64748b;
            --border-elegant: #e2e8f0;
          }

          .dark {
            --primary-navy: #0f172a;
            --primary-gold: #fbbf24;
            --accent-blue: #60a5fa;
            --soft-gray: #111827;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --border-elegant: #374151;
          }

          body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, var(--soft-gray) 0%, #ffffff 100%);
            transition: background-color 0.3s ease, color 0.3s ease;
          }

          .dark body {
            background: linear-gradient(135deg, var(--soft-gray) 0%, #1f2937 100%);
          }

          .elegant-shadow {
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
          }

          .dark .elegant-shadow {
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3), 0 2px 4px -2px rgb(0 0 0 / 0.2);
          }

          .luxury-gradient {
            background: linear-gradient(135deg, var(--primary-navy) 0%, #334155 100%);
          }

          .dark .luxury-gradient {
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
          }

          .drag-handle {
              cursor: move;
          }
        `}</style>

        <div className="min-h-screen flex w-full dark:bg-gray-900 transition-colors duration-300">
          <Sidebar className="border-r border-elegant elegant-shadow dark:border-gray-700">
            <SidebarHeader className="border-b border-elegant dark:border-gray-700 p-6 luxury-gradient">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-gold-400 to-gold-500 rounded-xl flex items-center justify-center elegant-shadow">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-lg tracking-tight">TimesPast</h2>
                    <p className="text-xs text-blue-100 font-medium">Interactive Historical Data</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleDarkMode}
                  className="text-white hover:bg-white/10 transition-colors duration-200"
                >
                  {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </Button>
              </div>
            </SidebarHeader>

            <SidebarContent className="p-4 bg-white dark:bg-gray-900 transition-colors duration-300">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-text-secondary dark:text-gray-400 uppercase tracking-wider px-3 py-3">
                  Main View
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <Button
                        variant="ghost"
                        onClick={() => mapPageContext?.setCurrentView('map')}
                        className={`
                          w-full justify-start gap-3 px-4 py-3 transition-all duration-300 rounded-xl
                          ${mapPageContext?.currentView === 'map' || !mapPageContext
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-accent-blue shadow-sm'
                            : 'text-text-primary dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/30'}
                        `}
                      >
                        <MapIcon className="w-5 h-5 transition-transform group-hover:scale-110" />
                        <span className="font-medium">Interactive Map</span>
                      </Button>
                    </SidebarMenuItem>

                    <SidebarMenuItem>
                      <Button
                        variant="ghost"
                        onClick={() => mapPageContext?.setCurrentView('globe')}
                        className={`
                          w-full justify-start gap-3 px-4 py-3 transition-all duration-300 rounded-xl
                          ${mapPageContext?.currentView === 'globe'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-accent-blue shadow-sm'
                            : 'text-text-primary dark:text-gray-100 hover:bg-blue-50 dark:hover:bg-blue-900/30'}
                        `}
                      >
                        <Globe className="w-5 h-5" />
                        <span className="font-medium">Interactive Globe</span>
                      </Button>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupContent>
                  {sidebarControls}
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup className="mt-auto">
                {/* Content for settings group would go here if provided */}
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col bg-soft-gray dark:bg-gray-900 transition-colors duration-300">
            <div className="flex-1 overflow-hidden relative">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </LayoutContext.Provider>
  );
}

