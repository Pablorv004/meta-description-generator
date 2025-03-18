import { useState, useMemo } from "react";

interface SearchableComboboxProps {
    items: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    disabled?: boolean;
    label?: string;
    id: string;
    openComboboxId: string | null;
    setOpenComboboxId: (id: string | null) => void;
}

export function SearchableCombobox({
    items,
    value,
    onChange,
    placeholder,
    disabled = false,
    label = "",
    id,
    openComboboxId,
    setOpenComboboxId
}: SearchableComboboxProps) {
    const [searchTerm, setSearchTerm] = useState("");
    
    const isOpen = openComboboxId === id;
    
    const toggleOpen = () => {
        if (disabled) return;
        if (isOpen) {
            setOpenComboboxId(null);
        } else {
            setOpenComboboxId(id);
        }
    };
    
    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        return items.filter(item => 
            item.label.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [items, searchTerm]);
    
    const selectedLabel = useMemo(() => {
        const item = items.find(i => i.value === value);
        return item ? item.label : placeholder;
    }, [value, items, placeholder]);
    
    return (
        <div className={`searchable-combobox ${disabled ? 'disabled' : ''}`}>
            {label && <label className="combobox-label">{label}</label>}
            <div 
                className="combobox-header" 
                onClick={toggleOpen}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                        toggleOpen();
                        e.preventDefault();
                    }
                }}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span>{selectedLabel}</span>
                <span className="dropdown-arrow">{isOpen ? "▲" : "▼"}</span>
            </div>
            
            {isOpen && !disabled && (
                <div className="dropdown-container">
                    <input 
                        type="text" 
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                    />
                    <div className="items-list" role="listbox">
                        {items.length === 0 && (
                            <div className="item empty">No items available</div>
                        )}
                        {filteredItems.map(item => (
                            <div 
                                key={item.value} 
                                className={`item ${value === item.value ? "selected" : ""}`}
                                onClick={() => {
                                    onChange(item.value);
                                    setOpenComboboxId(null);
                                    setSearchTerm("");
                                }}
                                role="option"
                                aria-selected={value === item.value}
                            >
                                {item.label}
                            </div>
                        ))}
                        {filteredItems.length === 0 && searchTerm && (
                            <div className="item empty">No matches found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
