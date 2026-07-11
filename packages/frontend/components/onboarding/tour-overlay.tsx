"use client";

import { useEffect, useRef } from "react";
import { driver, type Config, type Driver, type PopoverDOM } from "driver.js";

import { t } from "../../lib/onboarding/i18n";
import { anchorSelector } from "../../lib/onboarding/tour-content";
import type { UseTourEngineResult } from "../../lib/onboarding/use-tour-engine";
import type { TourStep } from "../../../shared/onboarding/content/schema";

export interface TourOverlayProps {
  engine: UseTourEngineResult;
  skipLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  doneLabel?: string;
}

interface OverlayLabels {
  skipLabel: string;
  nextLabel: string;
  backLabel: string;
  doneLabel: string;
}

const POPOVER_CLASS = "wv-tour-popover"; // ADR-001: no Driver.js default theme CSS ships.

function applyTokenStyles(popover: PopoverDOM): void {
  popover.wrapper.style.setProperty("background-color", "var(--color-surface)");
  popover.wrapper.style.setProperty("border", "1px solid var(--color-border)");
  popover.wrapper.style.setProperty("border-radius", "var(--radius-base)");
  popover.wrapper.style.setProperty("padding", "var(--space-4)");
  popover.wrapper.style.setProperty("box-shadow", "var(--shadow-panel)");
  popover.title.style.setProperty("color", "var(--color-text-default)");
  popover.description.style.setProperty("color", "var(--color-text-muted)");
  popover.description.style.setProperty("margin-top", "var(--space-2)");
}

function makeButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.className =
    "wv-tour-btn rounded-[var(--radius-base)] px-[var(--space-3)] py-[var(--space-1)] " +
    "text-[length:var(--text-body-sm)] bg-[var(--color-surface)] text-[var(--color-text-default)] " +
    "border border-[var(--color-border)] focus-visible:outline-none focus-visible:shadow-[var(--ring-focus)]";
  button.addEventListener("click", onClick);
  return button;
}

function appendStepIndicator(popover: PopoverDOM, stepNumber: number, totalSteps: number): void {
  const indicator = document.createElement("p");
  indicator.textContent = `${stepNumber} of ${totalSteps}`;
  indicator.setAttribute("aria-live", "polite");
  indicator.className = "mt-[var(--space-2)] text-[length:var(--text-body-sm)] text-[var(--color-text-muted)]";
  popover.wrapper.insertBefore(indicator, popover.footer);
}

function appendFooterButtons(popover: PopoverDOM, engine: UseTourEngineResult, labels: OverlayLabels): void {
  const isLastStep = engine.activeIndex + 1 === engine.totalSteps;
  const footer = document.createElement("div");
  footer.className = "mt-[var(--space-3)] flex justify-between gap-[var(--space-2)]";

  const backButton = makeButton(labels.backLabel, () => engine.back());
  backButton.disabled = engine.activeIndex === 0;

  const rightGroup = document.createElement("div");
  rightGroup.className = "flex gap-[var(--space-2)]";
  rightGroup.append(
    makeButton(labels.skipLabel, () => engine.skip()),
    makeButton(isLastStep ? labels.doneLabel : labels.nextLabel, () => engine.next()),
  );

  footer.append(backButton, rightGroup);
  popover.wrapper.appendChild(footer);
}

/** Driver.js stamps aria-haspopup/aria-expanded/aria-controls onto the
 * highlighted target regardless of that element's role -- invalid per WCAG's
 * aria-allowed-attr unless the target already supports those attributes.
 * The wrapper owns a11y (ADR-001): the popover carries dialog semantics
 * instead (AC-007-06). Driver.js sets these synchronously inside
 * `highlight()` and again from its own `onHighlighted` hook -- strip both
 * times so a fast-following check never sees them. */
function stripInvalidAriaFromTarget(element: Element | undefined | null): void {
  element?.removeAttribute("aria-haspopup");
  element?.removeAttribute("aria-expanded");
  element?.removeAttribute("aria-controls");
}

function buildStepConfig(
  step: TourStep,
  stepNumber: number,
  engine: UseTourEngineResult,
  labels: OverlayLabels,
): Config {
  return {
    allowKeyboardControl: false, // the wrapper owns all keyboard bindings (AC-007-03).
    showButtons: [],
    allowClose: false,
    animate: false, // AC-007-06: step transition budget is 200ms -- Driver.js's own fade adds only latency.
    disableActiveInteraction: true, // never require interacting with the highlighted element.
    popoverClass: POPOVER_CLASS,
    stagePadding: 4,
    onHighlighted: (element) => stripInvalidAriaFromTarget(element),
    onPopoverRender: (popover) => {
      popover.wrapper.setAttribute("role", "dialog");
      popover.wrapper.setAttribute("aria-label", t(step.titleKey));
      applyTokenStyles(popover);
      popover.title.textContent = t(step.titleKey);
      popover.description.textContent = t(step.bodyKey);
      appendStepIndicator(popover, stepNumber, engine.totalSteps);
      appendFooterButtons(popover, engine, labels);
    },
  };
}

/** ONB-TASK-007: Driver.js invoked as a dumb per-step spotlight renderer
 * (ADR-001) -- `useTourEngine` owns all sequencing/resume/skip state; this
 * component only highlights `engine.activeStep` and rebuilds the popover
 * from design tokens + i18n copy (no Driver.js default theme CSS, AC-007-07).
 */
export function TourOverlay({
  engine,
  skipLabel = "Skip tour",
  nextLabel = "Next",
  backLabel = "Back",
  doneLabel = "Done",
}: TourOverlayProps) {
  const driverRef = useRef<Driver | null>(null);
  const labels = { skipLabel, nextLabel, backLabel, doneLabel };

  useEffect(() => {
    if (engine.status !== "active" || !engine.activeStep) {
      driverRef.current?.destroy();
      driverRef.current = null;
      return undefined;
    }

    const step = engine.activeStep;
    const instance = driver(buildStepConfig(step, engine.activeIndex + 1, engine, labels));

    driverRef.current?.destroy();
    driverRef.current = instance;
    // `popover: {}` is required to make Driver.js render a popover at all --
    // its content is fully rebuilt by `onPopoverRender` above (tokens + i18n).
    instance.highlight({ element: anchorSelector(step.anchorId), popover: {} });
    stripInvalidAriaFromTarget(document.querySelector(anchorSelector(step.anchorId)));

    return () => instance.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `labels` is a fresh object per render but only step/status changes should re-highlight.
  }, [engine.status, engine.activeIndex, engine.activeStep, engine.totalSteps]);

  useEffect(() => {
    if (engine.status !== "active") return undefined;

    function onKeyDown(event: KeyboardEvent): void {
      // AC-007-03: keyboard-navigable, never requires the highlighted element.
      if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        engine.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        engine.back();
      } else if (event.key === "Escape") {
        event.preventDefault();
        engine.skip(); // AC-007-02: Escape exits without deleting progress.
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [engine]);

  useEffect(() => () => driverRef.current?.destroy(), []);

  return null;
}
