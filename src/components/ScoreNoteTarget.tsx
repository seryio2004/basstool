import React, { memo, useEffect, useMemo, useRef } from 'react';
import { PanResponder, Platform, Pressable, View, type ViewStyle } from 'react-native';
import type { EditCursor } from '../core/scoreTypes';

export type NoteSurface = 'staff' | 'tab';
export type NoteGesture = {
  select: (cursor: EditCursor) => void;
  start: (cursor: EditCursor) => void;
  preview: (cursor: EditCursor, surface: NoteSurface, delta: number) => void;
  finish: (cursor: EditCursor, commit: boolean) => void;
  fret: (cursor: EditCursor, semitones: number) => boolean;
};

type Contact = {
  x: number;
  y: number;
  moved: boolean;
  dragging: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

export const ScoreNoteTarget = memo(function ScoreNoteTarget({
  measure,
  event,
  string,
  surface,
  label,
  left,
  top,
  width,
  height,
  gesture,
}: EditCursor & {
  surface: NoteSurface;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
  gesture: NoteGesture;
}) {
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const cursor = useMemo(() => ({ measure, event, string }), [measure, event, string]);
  const input = useMemo(() => {
    let contact: Contact | undefined;
    const activate = () => {
      if (!contact || contact.moved || contact.dragging) return;
      contact.dragging = true;
      gesture.start(cursor);
    };
    return {
      begin(x: number, y: number, touch: boolean) {
        if (contact) return;
        contact = { x, y, moved: false, dragging: false };
        if (touch) contact.timer = setTimeout(activate, 250);
      },
      move(x: number, y: number, touch: boolean) {
        if (!contact) return false;
        const dy = y - contact.y;
        if (!touch && Math.abs(dy) >= 3 && !contact.dragging) {
          contact.dragging = true;
          gesture.start(cursor);
        }
        if (Math.hypot(x - contact.x, dy) > 6) contact.moved = true;
        if (contact.dragging) gesture.preview(cursor, surface, dy);
        return contact.dragging;
      },
      end(cancelled: boolean) {
        if (!contact) return;
        const { timer, dragging, moved } = contact;
        contact = undefined;
        clearTimeout(timer);
        if (dragging) gesture.finish(cursor, !cancelled);
        else if (!cancelled && !moved) gesture.select(cursor);
      },
      active: () => contact?.dragging ?? false,
    };
  }, [cursor, gesture, surface]);

  useEffect(() => {
    if (Platform.OS !== 'web') return () => input.end(true);
    const node = ref.current as unknown as HTMLElement | null;
    if (!node) return;
    let pointer: number | undefined;
    let finger: number | undefined;
    const down = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary) return;
      pointer = event.pointerId;
      node.focus({ preventScroll: true });
      node.setPointerCapture(pointer);
      input.begin(event.clientX, event.clientY, false);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId === pointer) input.move(event.clientX, event.clientY, false);
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = undefined;
      if (event.type === 'pointerup') input.move(event.clientX, event.clientY, false);
      input.end(event.type !== 'pointerup');
    };
    const touch = (event: TouchEvent) =>
      Array.from(event.changedTouches).find((item) => item.identifier === finger);
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        input.end(true);
        finger = undefined;
        return;
      }
      const item = event.changedTouches[0];
      if (!item) return;
      finger = item.identifier;
      input.begin(item.clientX, item.clientY, true);
    };
    const touchMove = (event: TouchEvent) => {
      const item = touch(event);
      if (!item) return;
      if (!event.cancelable) {
        input.end(true);
        finger = undefined;
      } else if (input.move(item.clientX, item.clientY, true)) event.preventDefault();
    };
    const touchEnd = (event: TouchEvent) => {
      if (!touch(event)) return;
      finger = undefined;
      input.end(event.type === 'touchcancel');
    };
    const wheel = (event: WheelEvent) => {
      if (
        surface === 'tab' &&
        event.deltaY &&
        !event.ctrlKey &&
        gesture.fret(cursor, event.deltaY < 0 ? 1 : -1)
      )
        event.preventDefault();
    };
    const contextMenu = (event: MouseEvent) => {
      if (finger !== undefined && input.active()) event.preventDefault();
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('lostpointercapture', end);
    node.addEventListener('touchstart', touchStart);
    node.addEventListener('touchmove', touchMove, { passive: false });
    node.addEventListener('touchend', touchEnd);
    node.addEventListener('touchcancel', touchEnd);
    node.addEventListener('wheel', wheel, { passive: false });
    node.addEventListener('contextmenu', contextMenu);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', end);
      node.removeEventListener('pointercancel', end);
      node.removeEventListener('lostpointercapture', end);
      node.removeEventListener('touchstart', touchStart);
      node.removeEventListener('touchmove', touchMove);
      node.removeEventListener('touchend', touchEnd);
      node.removeEventListener('touchcancel', touchEnd);
      node.removeEventListener('wheel', wheel);
      node.removeEventListener('contextmenu', contextMenu);
      input.end(true);
    };
  }, [cursor, gesture, input, surface]);

  const native = useMemo(() => {
    if (Platform.OS === 'web') return;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: ({ nativeEvent: e }) => input.begin(e.pageX, e.pageY, true),
      onPanResponderMove: ({ nativeEvent: e }) => input.move(e.pageX, e.pageY, true),
      onPanResponderTerminationRequest: () => !input.active(),
      onPanResponderRelease: () => input.end(false),
      onPanResponderTerminate: () => input.end(true),
    });
  }, [input]);
  const style: ViewStyle = { position: 'absolute', left, top, width, height };
  const activate = () => gesture.select(cursor);
  if (Platform.OS === 'web')
    return (
      <Pressable
        ref={ref}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={`score-note-${measure}-${event}-${string}-${surface}`}
        tabIndex={-1}
        onPress={(event) => {
          if (!(event.nativeEvent as unknown as MouseEvent).detail) activate();
        }}
        style={{ ...style, cursor: 'grab' } as unknown as ViewStyle}
      />
    );
  return (
    <View
      {...native?.panHandlers}
      style={style}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      onAccessibilityTap={activate}
      accessibilityActions={[{ name: 'activate' }]}
      onAccessibilityAction={activate}
    />
  );
});
