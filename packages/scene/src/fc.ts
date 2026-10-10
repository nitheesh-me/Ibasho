/**
 * Core describes plugin components structurally (`Component<P>`, ARCH 5.6) because L0 cannot
 * import React. This narrows one back to a React component for JSX. Owner: WP-07.
 */
import type { Component } from '@ibasho/core';
import type { FC } from 'react';

export function fc<P>(c: Component<P>): FC<P> {
  return c as FC<P>;
}
