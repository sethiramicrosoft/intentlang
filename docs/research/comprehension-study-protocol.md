# IntentLang Comprehension Study Protocol

**Status**: Ready for ethics and participant review; no participant data has
been collected.

## Research question

Can representative readers interpret and safely modify IntentLang programs more
accurately, confidently, and quickly than equivalent conventional application
code without gaining false confidence?

## Participants

Recruit adults who voluntarily identify with one primary cohort:

- domain experts who specify business rules but do not program daily;
- software developers;
- security or application-risk reviewers;
- beginners with no more than one year of programming experience.

Target at least 8 completed participants per cohort for a pilot. Report the
actual sample and uncertainty; do not imply statistical significance from a
small pilot.

## Ethics and consent

- Participation is voluntary and may stop at any time without penalty.
- Explain the purpose, tasks, duration, data collected, retention period, and
  publication plan before consent.
- Do not collect names, employers, email addresses, IP addresses, free-form
  demographic histories, health data, or other sensitive personal information.
- Assign a random participant code locally.
- Collect only cohort, experience band, task answers, confidence, timing, and
  optional task-focused comments.
- Warn participants not to paste proprietary code, credentials, personal data,
  or employer information.
- Store consent separately from task results if consent records are required.
- Obtain applicable institutional or organizational ethics approval before
  recruitment when required.

## Design

Use a randomized counterbalanced crossover design. Each participant completes
equivalent tasks in both representations, but never sees both representations
of the same task. Rotate representation and task order using the assignment
groups in `studies/comprehension/tasks.json`.

The facilitator must not explain syntax after a timed task starts. Participants
may use only the supplied one-page language reference. Record interruptions and
exclude affected timing measurements without discarding correctness data.

## Measures

For each task record:

- correctness score using the published rubric;
- completion time in whole seconds;
- confidence from 1 (guessing) to 5 (certain);
- introduced defects after a modification task;
- whether the participant identified security and ambiguity risks;
- optional task-focused comment.

After at least 48 hours, use the retention task without showing the original
source. Record correctness and confidence again.

## Analysis

Publish anonymized aggregate results by cohort and representation:

- completion count and exclusions;
- median and interquartile completion time;
- mean and distribution of correctness;
- defect and security-risk detection rates;
- calibration gap between confidence and correctness;
- retention score;
- all negative or null findings.

Do not remove outliers solely because they weaken the claim. Predeclare any
exclusion rule. Do not publish raw comments that could identify a participant.

## Stop conditions

Pause the study if a task is materially easier in one representation for
reasons unrelated to language design, the rubric is ambiguous, participants
reveal sensitive information, or more than 20% of a cohort cannot understand
the instructions. Correct the materials, version them, and restart affected
tasks rather than mixing incompatible results.

## Reproducibility

The study version is the Git commit containing the protocol, task corpus,
rubrics, result schema, and analysis script. Published findings must cite that
commit and include the raw anonymized dataset or a documented reason it cannot
be released. `src/language/study-analysis.ts` computes the predeclared
correctness distribution, timing median and interquartile range, confidence
calibration, defect rate, security-risk detection rate, exclusions, and
retention correctness. It returns no participant codes.
