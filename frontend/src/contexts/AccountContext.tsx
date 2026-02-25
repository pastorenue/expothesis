import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AccountContextType {
    activeAccountId: string;
    setActiveAccountId: (id: string) => void;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export const AccountProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [activeAccountId, setActiveAccountIdState] = useState<string>(() => {
        return window.localStorage.getItem('expothesis-account-id') || '';
    });

    const setActiveAccountId = (id: string) => {
        window.localStorage.setItem('expothesis-account-id', id);
        setActiveAccountIdState(id);
    };

    // Keep state in sync with localStorage updates from other tabs/windows if needed
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'expothesis-account-id' && e.newValue !== activeAccountId) {
                setActiveAccountIdState(e.newValue || '');
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [activeAccountId]);

    return (
        <AccountContext.Provider value={{ activeAccountId, setActiveAccountId }}>
            {children}
        </AccountContext.Provider>
    );
};

export const useAccount = () => {
    const context = useContext(AccountContext);
    if (context === undefined) {
        throw new Error('useAccount must be used within an AccountProvider');
    }
    return context;
};
