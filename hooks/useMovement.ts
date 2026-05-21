"use client";

import { useEffect, useRef } from "react";

export interface MovementState {
    moveForward: boolean;
    moveBackward: boolean;
    moveLeft: boolean;
    moveRight: boolean;
    boost: boolean;
}

export function useMovement(): React.MutableRefObject<MovementState> {
    const movement = useRef<MovementState>({
        moveForward: false,
        moveBackward: false,
        moveLeft: false,
        moveRight: false,
        boost: false,
    });

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            const code = event.code;
            if (code === "ArrowUp" || code === "KeyW") {
                movement.current.moveForward = true;
            } else if (code === "ArrowDown" || code === "KeyS") {
                movement.current.moveBackward = true;
            } else if (code === "ArrowRight" || code === "KeyD") {
                movement.current.moveRight = true;
            } else if (code === "ArrowLeft" || code === "KeyA") {
                movement.current.moveLeft = true;
            } else if (code === "ShiftLeft") {
                movement.current.boost = true;
            }
        };

        const onKeyUp = (event: KeyboardEvent) => {
            const code = event.code;
            if (code === "ArrowUp" || code === "KeyW") {
                movement.current.moveForward = false;
            } else if (code === "ArrowDown" || code === "KeyS") {
                movement.current.moveBackward = false;
            } else if (code === "ArrowRight" || code === "KeyD") {
                movement.current.moveRight = false;
            } else if (code === "ArrowLeft" || code === "KeyA") {
                movement.current.moveLeft = false;
            } else if (code === "ShiftLeft") {
                movement.current.boost = false;
            }
        };

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    return movement;
}
