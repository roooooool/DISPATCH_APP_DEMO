# Prompt-to-Solution Decision Guide

This document explains how solutions are derived from a prompt in this project, especially when the request is brief, ambiguous, or implementation-focused.

## 1. First questions to ask before answering

Before writing code or proposing a change, the following questions are considered:

- What is the user really trying to achieve?
- Is the request a direct implementation task, a bug fix, a refactor, or a design decision?
- Is there enough context in the prompt, or is important detail missing?
- Which files, components, or modules are affected?
- Is the request tied to existing project patterns, conventions, or UI standards?
- What is the smallest useful change that satisfies the goal?
- What could break if this change is applied incorrectly?
- Is the user asking for a quick answer, a full implementation, or a guided explanation?

These questions help translate a prompt into a clear action plan.

## 2. How a vague prompt becomes an objective goal

When a prompt is vague, it is converted into a concrete objective by breaking it down into specific outcomes.

Example:

- Vague prompt: "make this better"
- Objective goal: "update the component so it handles the new exception condition and preserves existing behavior"

A vague instruction becomes actionable when it is rewritten into:

- a clear desired behavior
- a scope boundary
- an expected result
- a validation step

## 3. Practical decision process

The solution process usually follows this flow:

1. Understand the request
   - Identify the intent behind the prompt.
   - Determine whether the user wants code, explanation, or both.

2. Inspect the relevant project context
   - Read the affected component, utility, or page.
   - Check existing patterns already used in the project.

3. Identify constraints
   - Consider naming conventions, styling patterns, existing state logic, and architecture.
   - Avoid introducing a pattern that conflicts with the codebase.

4. Turn the request into a target outcome
   - Rephrase the prompt into a measurable objective.
   - Example: "Add a new conditional exemption for trips with a specific OE prefix."

5. Implement the smallest correct solution
   - Prefer the least disruptive change that solves the issue.
   - Keep behavior consistent with current logic.

6. Verify the result
   - Check that the change works as intended.
   - Confirm that no existing behavior was accidentally broken.

## 4. How to handle ambiguous prompts

If the prompt is incomplete, the next step is to make reasonable assumptions and clarify where needed.

Typical handling approach:

- Fill in obvious gaps from the surrounding codebase.
- Follow existing project conventions unless the user specifies otherwise.
- Ask a short clarifying question if the ambiguity affects the implementation significantly.

## 5. Example mindset

When a request says:

"Add another conditional for the exception."

The likely interpretation becomes:

- find the existing exemption logic
- identify what condition is already being checked
- add one more condition that fits the same rule
- preserve the current overall behavior

This turns a loose instruction into a targeted implementation task.

## 6. Good prompt design habits

To make future requests easier to solve, prompts should ideally include:

- the goal
- the relevant file or component
- expected behavior
- any examples or edge cases
- constraints or preferences

Example of a stronger prompt:

"In the trip task tracker, add an additional exemption rule so trips whose OE starts with MOB are treated the same as the existing source-name and cement-type exceptions."

## 7. Summary

A solution is built by moving from a prompt to a clear objective through four steps:

- understand the intent
- inspect the context
- define the expected behavior
- implement and verify the smallest correct change

This approach helps turn incomplete or vague instructions into reliable, project-aligned results.
