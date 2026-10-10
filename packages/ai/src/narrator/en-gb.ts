/**
 * en-GB template pack (UX 15: a calm architect friend who sketches while talking; short sentences,
 * British spelling, never salesy). Each key has seeded variants (SPEC 10: seed = bundle hash).
 *
 * Placeholders, filled by the template narrator:
 *   {e:ROLE}  {e:ROLE|abs}  {e:ROLE|approx}   evidence slot for a bundle role
 *   {m:VAR}   measure slot from a context variable    {ms:VAR}   list of measure slots
 *   {t:VAR}   context text (must be digit free)
 * `$name` inside a role is replaced by a local variable (`pick.$p.upfront`).
 *
 * Every variant must pass the validator G1 to G8 on its own bundle: the template is the fallback.
 */
import type { TemplatePack } from '@ibasho/core';

export const EN_GB: TemplatePack = {
  locale: 'en-GB',
  templates: {
    // Overview
    'overview.score': ['Your home scores {e:home.score} today.', 'Today your home scores {e:home.score}.'],
    'overview.bill': [
      'Heating, hot water and power cost about {e:home.bill|approx}.',
      'You spend about {e:home.bill|approx} on energy.',
    ],
    'overview.fuels': [
      'Gas use is {e:home.gas}, electricity {e:home.electricity}.',
      'It uses {e:home.gas} for gas. Electricity comes to {e:home.electricity}.',
    ],
    'overview.carbon': ['Running it puts out {e:home.carbon}.', 'Its carbon comes to {e:home.carbon}.'],

    // Chapter 1, Your home (ie)
    'chapter.ie.open': [
      'This is your home. On a typical January night at {e:climate.januaryNightC} °C outside, it loses heat at {e:home.januaryLossKW} kW.',
    ],
    'chapter.ie.top': [
      'Ranked by heat lost, {e:loss.top.rank} place goes to {t:topLossName}, about {e:loss.top.share|approx} of the total.',
      'Ranked by heat lost, {t:topLossName} take {e:loss.top.rank} place, with about {e:loss.top.share|approx} of the total.',
    ],
    'chapter.ie.year': [
      'Keeping it warm takes {e:home.heatDemand}.',
      'Heating it takes {e:home.heatDemand}.',
    ],

    // Chapter 2, Your bills (kan)
    'chapter.kan.open': ["Let's check us against your bills."],
    'chapter.kan.increase': [
      'Your bills show more gas than we modelled. Our estimate moves from {e:calibration.before} to {e:calibration.after}.',
      'You use more gas than our first guess. We move from {e:calibration.before} to {e:calibration.after}.',
    ],
    'chapter.kan.saving': [
      'Your bills show less gas than we modelled. Our estimate moves from {e:calibration.before} to {e:calibration.after}.',
      'You use less gas than our first guess. We move from {e:calibration.before} to {e:calibration.after}.',
    ],
    'chapter.kan.neutral': [
      'Your bills match the model closely. We keep our estimate of {e:calibration.after}.',
    ],
    'chapter.kan.size': ['That is a change of {e:calibration.shift|abs}.'],
    'chapter.kan.nobills': [
      'Add a year of meter readings and our estimate tightens. Until then we show a range from homes like yours.',
    ],

    // Chapter 3, What if (kokoromi)
    'chapter.kokoromi.open': ['Bigger radiators, or the loft first?'],
    'chapter.kokoromi.lever': [
      'Ranked by how far it moves your bill, {m:leverMeasure} comes {e:lever.top.rank}. On its own it cuts the bill by {e:lever.top.bill|abs}.',
      'Of the levers here, {m:leverMeasure} comes {e:lever.top.rank} for your bill. On its own it cuts the bill by {e:lever.top.bill|abs}.',
    ],
    'chapter.kokoromi.flow': [
      'Flow temperature matters too: at {e:lever.flowC} °C the radiators still keep the rooms warm.',
    ],

    // Chapter 4, Three futures (michi)
    'chapter.michi.open': ['Many changes are possible. Three stand out.'],
    'chapter.michi.leastUpfront': [
      'Least upfront: {ms:pickMeasures} for {e:pick.$p.upfront}, cutting bills by {e:pick.$p.saving|abs}.',
      'Least upfront is {ms:pickMeasures}: {e:pick.$p.upfront}, and it cuts bills by {e:pick.$p.saving|abs}.',
    ],
    'chapter.michi.bestReturn': [
      'Best return: {ms:pickMeasures} for {e:pick.$p.upfront}, cutting bills by {e:pick.$p.saving|abs}.',
      'Best return is {ms:pickMeasures}: {e:pick.$p.upfront}, and it cuts bills by {e:pick.$p.saving|abs}.',
    ],
    'chapter.michi.lowestRunningCarbon': [
      'Lowest running carbon: {ms:pickMeasures} for {e:pick.$p.upfront}, cutting carbon by {e:pick.$p.carbon|abs}.',
      'Lowest running carbon is {ms:pickMeasures}: {e:pick.$p.upfront}, and it cuts carbon by {e:pick.$p.carbon|abs}.',
    ],
    'chapter.michi.hidden.one': ['{e:hidden.count} future is hidden by something you ruled out.'],
    'chapter.michi.hidden.many': ['{e:hidden.count} futures are hidden by things you ruled out.'],
    'chapter.michi.needsCheck': ['Some others become possible after a check. They wait in their own lane.'],
    'chapter.michi.budget': ['What would you like to spend? Tell us and we will look at the three again.'],

    // Chapter 5, Your place (ibasho)
    'chapter.ibasho.open': ['Here is your home, mended.'],
    'chapter.ibasho.after': [
      'With {ms:chosenMeasures}, bills fall by {e:pick.$p.saving|abs} and carbon by {e:pick.$p.carbon|abs}.',
      'After {ms:chosenMeasures}, bills fall by {e:pick.$p.saving|abs} and carbon by {e:pick.$p.carbon|abs}.',
    ],
    'chapter.ibasho.payback': ['It pays back in about {e:pick.$p.payback|approx}.'],
    'chapter.ibasho.next': ['Your next step: {t:nextStep}.'],
    'chapter.ibasho.seal': ['Nothing better is hidden. The check below shows why.'],

    // Package
    'package.what': ['This future brings {ms:packageMeasures}.', 'This one is {ms:packageMeasures}.'],
    'package.upfront': ['It costs {e:pkg.$p.upfront} upfront.', 'Upfront, it costs {e:pkg.$p.upfront}.'],
    'package.saving.saving': [
      'It cuts your bills by {e:pkg.$p.saving|abs}.',
      'Your bills go down by {e:pkg.$p.saving|abs}.',
    ],
    'package.saving.increase': ['Your bills go up by {e:pkg.$p.saving|abs}.'],
    'package.gas.saving': ['Gas use goes down by {e:pkg.$p.gas|abs}.'],
    'package.gas.increase': ['Gas use goes up by {e:pkg.$p.gas|abs}.'],
    'package.electricity.saving': ['Electricity use goes down by {e:pkg.$p.electricity|abs}.'],
    'package.electricity.increase': ['Electricity use goes up by {e:pkg.$p.electricity|abs}.'],
    'package.carbon.saving': [
      'Carbon falls by {e:pkg.$p.carbon|abs}.',
      'It cuts carbon by {e:pkg.$p.carbon|abs}.',
    ],
    'package.carbon.increase': ['Carbon rises by {e:pkg.$p.carbon|abs}.'],
    'package.payback': ['It pays back in about {e:pkg.$p.payback|approx}.'],

    // Trade-off between two picks
    'tradeoff.upfront': [
      '{t:nameA} costs {e:pick.$a.upfront} to start. {t:nameB} costs {e:pick.$b.upfront}.',
    ],
    'tradeoff.saving': [
      '{t:nameA} cuts bills by {e:pick.$a.saving|abs}. {t:nameB} cuts them by {e:pick.$b.saving|abs}.',
    ],
    'tradeoff.carbon': [
      '{t:nameA} cuts carbon by {e:pick.$a.carbon|abs}. {t:nameB} cuts it by {e:pick.$b.carbon|abs}.',
    ],
    'tradeoff.fuel': ['With a heat pump, gas goes down and electricity goes up a little.'],

    // Answer
    'answer.found': [
      'The closest figure we have is {t:label}: {e:$r}.',
      'Here is what the model says, {t:label}: {e:$r}.',
    ],
    'answer.bare': ['The closest figure we have is {e:$r}.'],
    'answer.none': ["We don't have a figure for that yet. Ask about cost, bills, carbon or comfort."],

    // Welcome back
    'welcome.greet.one': ["Welcome back. It's been {e:visit.daysSince} day."],
    'welcome.greet.many': [
      "Welcome back. It's been {e:visit.daysSince} days.",
      'Welcome back. {e:visit.daysSince} days have passed since your last visit.',
    ],
    'welcome.greet.none': ['Welcome back.'],
    'welcome.season.heating': ['The heating season is here.', 'It is heating season again.'],
    'welcome.season.summer': ['Summer is the quiet season for heating.'],
    'welcome.diff': ['{t:diffReason} Your score moved from {e:diff.score.before} to {e:diff.score.after}.'],
    'welcome.plan': ['{e:plan.done} of {e:plan.total} steps are done.'],
    'welcome.memory': ['You told us no to {m:rejectedMeasure}. Still true?'],
    'welcome.next': ['Your next step: {t:nextStep}.'],

    // Why not
    'whynot.rule.needs-check': ['{m:measure} needs {t:ruleTitle} first, so it waits in the check lane.'],
    'whynot.rule.blocked': ['{m:measure} is not allowed here: {t:ruleTitle}.'],
    'whynot.memory': ['You ruled out {m:measure}, so it never came back.'],
    'whynot.tenure': ["{m:measure} needs your landlord's agreement. We can draft a letter."],
    'whynot.dominated': ['{m:measure} was left out: a future without it does as well for less.'],
    'whynot.budget': ['{m:measure} would take you past your budget.'],
    'whynot.budget.by': ['{m:measure} would take you past your budget by {e:$r}.'],
    'whynot.na': ['{m:measure} does not apply to this home.'],
    'whynot.none': ['Every measure that applies here appears in a future.'],
  },
};
