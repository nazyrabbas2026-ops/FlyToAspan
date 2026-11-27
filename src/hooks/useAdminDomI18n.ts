import { useLayoutEffect, type RefObject } from 'react';
import type { LangCode } from '../types';
import { translateAdminText } from '../i18n/adminI18n';

const ATTRS = ['placeholder', 'title', 'aria-label', 'data-label'] as const;

const rawTextMap = new WeakMap<Text, string>();
const lastWrittenTextMap = new WeakMap<Text, string>();
const rawAttrMap = new WeakMap<Element, Record<string, string>>();
const lastWrittenAttrMap = new WeakMap<Element, Record<string, string>>();

function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') return true;
  if (el.closest('[data-no-i18n="true"]')) return true;
  return false;
}

function processTextNode(node: Text, lang: LangCode) {
  if (shouldSkipElement(node.parentElement)) return;
  const current = node.data;
  if (!current.trim()) return;

  const lastWritten = lastWrittenTextMap.get(node);
  if (lastWritten !== current) {
    // Either first observation or React updated the underlying TR text
    rawTextMap.set(node, current);
  }
  const source = rawTextMap.get(node) ?? current;
  const next = lang === 'TR' ? source : translateAdminText(source, lang);
  if (node.data !== next) {
    lastWrittenTextMap.set(node, next);
    node.data = next;
  }
}

function processElementAttrs(el: Element, lang: LangCode) {
  if (shouldSkipElement(el)) return;
  let rawRec = rawAttrMap.get(el);
  let writtenRec = lastWrittenAttrMap.get(el);

  for (const attr of ATTRS) {
    const val = el.getAttribute(attr);
    if (!val) continue;
    if (!rawRec) {
      rawRec = {};
      rawAttrMap.set(el, rawRec);
    }
    if (!writtenRec) {
      writtenRec = {};
      lastWrittenAttrMap.set(el, writtenRec);
    }
    if (writtenRec[attr] !== val) {
      rawRec[attr] = val;
    }
    const source = rawRec[attr] ?? val;
    const next = lang === 'TR' ? source : translateAdminText(source, lang);
    if (val !== next) {
      writtenRec[attr] = next;
      el.setAttribute(attr, next);
    }
  }
}

function translateSubtree(root: Node, lang: LangCode) {
  if (root.nodeType === Node.TEXT_NODE) {
    processTextNode(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;

  const rootEl = root as Element;
  processElementAttrs(rootEl, lang);

  const elWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT);
  let curEl: Node | null;
  while ((curEl = elWalker.nextNode())) {
    processElementAttrs(curEl as Element, lang);
  }

  const textWalker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
  let curText: Node | null;
  while ((curText = textWalker.nextNode())) {
    processTextNode(curText as Text, lang);
  }
}

/**
 * State-preserving, flicker-free DOM i18n boundary for the Admin Panel.
 * Uses useLayoutEffect + WeakMap source tracking + scoped MutationObserver so switching
 * TR <-> EN <-> RU <-> KK translates every tab, modal, placeholder, and dynamic toast
 * without remounting forms or breaking React reconciliation.
 */
export function useAdminDomI18n(rootRef: RefObject<HTMLElement | null>, lang: LangCode) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    translateSubtree(root, lang);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'characterData' && m.target.nodeType === Node.TEXT_NODE) {
          processTextNode(m.target as Text, lang);
        } else if (m.type === 'attributes' && m.target.nodeType === Node.ELEMENT_NODE) {
          processElementAttrs(m.target as Element, lang);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((n) => translateSubtree(n, lang));
        }
      }
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });

    return () => observer.disconnect();
  }, [rootRef, lang]);
}
