import React from "react";
import { Link } from "react-router-dom";

// Create a context to hold sidebar state
const SidebarContext = React.createContext();

/**
 * Provides sidebar state and toggle functionality to its children.
 * Manages responsive state for mobile and desktop.
 */
export function SidebarProvider({ children }) {
  const [isMobileOpen, setIsMobileOpen] = React.useState(false);

  const toggleSidebar = () => {
    setIsMobileOpen(prev => !prev);
  };

  const value = {
    isMobileOpen,
    toggleSidebar,
    isExpanded: true, 
  };

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

/**
 * Custom hook to access sidebar state and functions.
 */
export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

/**
 * Main sidebar container. Handles responsive visibility.
 * It's always present on desktop and slides in as an overlay on mobile.
 */
export function Sidebar({ children, className }) {
    const { isMobileOpen, toggleSidebar } = useSidebar();

    return (
        <>
            {/* Desktop Sidebar (always visible) */}
            <aside className={`hidden md:flex flex-col h-screen w-72 ${className}`}>
                {children}
            </aside>

            {/* Mobile Sidebar (overlay) */}
            <div className={`fixed inset-0 z-40 flex md:hidden transition-transform duration-300 ease-in-out ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <aside className={`flex flex-col h-full w-72 shadow-lg ${className}`}>
                    {children}
                </aside>
                <div className="flex-1 bg-black/50" onClick={toggleSidebar}></div>
            </div>
        </>
    );
}

export function SidebarHeader({ children, className }) {
  return <div className={`flex items-center justify-between ${className}`}>{children}</div>;
}

export const SidebarBody = React.forwardRef(({ children, className, ...props }, ref) => {
  return <nav ref={ref} className={`flex-1 ${className}`} {...props}>{children}</nav>;
});
SidebarBody.displayName = 'SidebarBody';


export function SidebarFooter({ children, className }) {
  return <div className={`${className}`}>{children}</div>;
}

/**
 * An item within the sidebar, can be a link or a button.
 */
export function SidebarItem({ to, onClick, children, className }) {
  const commonProps = {
    className,
    onClick,
  };

  if (to) {
    return (
      <Link to={to} {...commonProps}>
        {children}
      </Link>
    );
  }

  return (
    <button {...commonProps}>
      {children}
    </button>
  );
}