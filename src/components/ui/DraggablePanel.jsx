import React, { useState, useRef, useEffect } from 'react';

export default function DraggablePanel({ children, initialPosition, className, dragHandleClassName }) {
    const [position, setPosition] = useState(initialPosition || { x: 24, y: 24 });
    const [isDragging, setIsDragging] = useState(false);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const panelRef = useRef(null);

    const handleMouseDown = (e) => {
        // If a drag handle is specified, only start dragging if the mouse is down on the handle
        if (dragHandleClassName && !e.target.closest(`.${dragHandleClassName}`)) {
            return;
        }

        if (panelRef.current) {
            const rect = panelRef.current.getBoundingClientRect();
            setOffset({
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            });
            setIsDragging(true);
            e.stopPropagation(); // Prevent text selection while dragging
        }
    };

    const handleMouseMove = (e) => {
        if (!isDragging) return;
        e.preventDefault();
        setPosition({
            x: e.clientX - offset.x,
            y: e.clientY - offset.y,
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        const moveHandler = (e) => handleMouseMove(e);
        const upHandler = () => handleMouseUp();

        if (isDragging) {
            document.addEventListener('mousemove', moveHandler);
            document.addEventListener('mouseup', upHandler);
        }

        return () => {
            document.removeEventListener('mousemove', moveHandler);
            document.removeEventListener('mouseup', upHandler);
        };
    }, [isDragging]);

    return (
        <div
            ref={panelRef}
            className={`absolute z-[1000] ${className}`}
            style={{ top: `${position.y}px`, left: `${position.x}px` }}
            onMouseDown={handleMouseDown}
        >
            {children}
        </div>
    );
}
