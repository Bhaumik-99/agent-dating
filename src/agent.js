/**
 * agent.js
 * Object-oriented Dating Agent system for the Agentic Dating platform.
 * 
 * Features:
 * - Real DatingAgent class representing each person
 * - Independent inspection, proposal, evaluation, and decision-making
 * - Dynamic multi-turn dating harness grounded in profile facts
 * - Speech and private "think" turns
 * - Zero external LLM / API calls
 */

import { analyzePersonLocally } from './analyzer.js';

export class DatingAgent {
  constructor(person, profile = null) {
    this.person = person;
    this.profile = profile || person.profile || {};
    this.name = person.name;
    this.id = person.id;
  }

  /**
   * Inspects another agent's profile to discover shared signals and potential friction.
   */
  inspect(otherAgent) {
    const myInterests = this.profile.interests || [];
    const theirInterests = otherAgent.profile.interests || [];
    const myHobbies = this.profile.hobbies || [];
    const theirHobbies = otherAgent.profile.hobbies || [];
    const myWork = this.profile.work_style || [];
    const theirWork = otherAgent.profile.work_style || [];

    const sharedInterests = myInterests.filter(i =>
      theirInterests.some(ti => ti.toLowerCase() === i.toLowerCase() || i.toLowerCase().includes(ti.toLowerCase()) || ti.toLowerCase().includes(i.toLowerCase()))
    );

    const sharedHobbies = myHobbies.filter(h =>
      theirHobbies.some(th => th.toLowerCase() === h.toLowerCase() || h.toLowerCase().includes(th.toLowerCase()) || th.toLowerCase().includes(h.toLowerCase()))
    );

    const workSynergy = myWork.filter(w =>
      theirWork.some(tw => tw.toLowerCase() === w.toLowerCase())
    );

    // Friction detection: divergent focus or pace
    const frictionPoints = [];
    if (sharedInterests.length === 0) {
      frictionPoints.push(`Divergent domain focuses (${myInterests[0] || 'general'} vs ${theirInterests[0] || 'general'})`);
    }
    if (myHobbies.length > 0 && theirHobbies.length === 0) {
      frictionPoints.push('Asymmetry in public recreational activities');
    }

    return {
      sharedInterests: Array.from(new Set(sharedInterests)),
      sharedHobbies: Array.from(new Set(sharedHobbies)),
      workSynergy: Array.from(new Set(workSynergy)),
      frictionPoints
    };
  }

  /**
   * Proposes a concrete date activity grounded in mutual or own interests.
   */
  proposeDate(inspection) {
    const sharedHobby = inspection.sharedHobbies[0];
    const sharedInterest = inspection.sharedInterests[0];

    if (sharedHobby && sharedHobby.toLowerCase().includes('running')) {
      return {
        venue: 'A quiet scenic trail near the bay',
        activity: 'Morning 5k trail run followed by artisan espresso',
        shared_signal: sharedHobby,
        pitch: `Since we both prioritize fitness and running, how about an easy morning 5k trail run followed by coffee? Takes the pressure off and lets conversation flow naturally.`
      };
    }

    if (sharedHobby && (sharedHobby.toLowerCase().includes('cricket') || sharedHobby.toLowerCase().includes('football'))) {
      return {
        venue: 'Stadium VIP Lounge & Box',
        activity: 'Watching an evening championship match',
        shared_signal: sharedHobby,
        pitch: `I noticed our shared enthusiasm for live sports. Let's catch the championship match from a quiet lounge where we can actually talk strategy and business between plays.`
      };
    }

    if (sharedHobby && sharedHobby.toLowerCase().includes('photography')) {
      return {
        venue: 'City Arts & Architecture District',
        activity: 'Golden-hour architectural photo walk and gallery discussion',
        shared_signal: sharedHobby,
        pitch: `Since photography is a shared passion, let's do a golden-hour photo walk through the historic arts district, then grab dinner to talk through our favorite projects.`
      };
    }

    if (sharedInterest && sharedInterest.toLowerCase().includes('artificial intelligence')) {
      return {
        venue: 'A private salon during an AI research summit',
        activity: 'Dissecting frontier autonomous systems over dinner',
        shared_signal: sharedInterest,
        pitch: `Given our mutual focus on frontier intelligence systems, I propose dinner at a quiet spot right after the keynote demo day to debate where the architecture is heading.`
      };
    }

    // Default grounded activity
    const activity = this.profile.date_ideas?.[0] || 'Coffee and a focused walk discussing long-term projects';
    return {
      venue: 'An independent artisan coffee roastery',
      activity,
      shared_signal: sharedInterest || 'Technology & Entrepreneurship',
      pitch: `Let's skip the standard networking dinner and meet at a quiet roastery. ${activity}. Concrete and unhurried.`
    };
  }

  /**
   * Evaluates another agent's proposal.
   */
  evaluateProposal(proposal, inspection) {
    const isSharedHobby = inspection.sharedHobbies.some(h => proposal.activity.toLowerCase().includes(h.toLowerCase()));
    const isSharedInterest = inspection.sharedInterests.some(i => proposal.shared_signal.toLowerCase().includes(i.toLowerCase()));

    if (isSharedHobby || isSharedInterest) {
      return {
        accept: true,
        modification: null,
        reaction: `That proposal resonates directly with how I like to spend time. It avoids small talk and focuses on something substantive.`
      };
    }

    // Counter-proposal / refinement
    return {
      accept: true,
      modification: 'Let us start with coffee first, then extend to the activity if the conversational rhythm works',
      reaction: `I like the intention, though I usually prefer starting with a focused coffee conversation to establish alignment before the full activity.`
    };
  }

  /**
   * Finalizes individual decision for the agent.
   */
  finalizeDate(otherAgent, inspection, chemistryScore) {
    if (chemistryScore >= 65 && inspection.frictionPoints.length === 0) {
      return {
        continue: true,
        reason: `Strong intellectual rapport on ${inspection.sharedInterests[0] || 'core vision'} and compatible operating tempo.`
      };
    } else if (chemistryScore >= 50) {
      return {
        continue: true,
        reason: `Promising shared curiosity on ${inspection.sharedInterests[0] || 'technology'}, worth a second focused conversation.`
      };
    } else {
      return {
        continue: false,
        reason: `Respectful interaction, but fundamentally divergent priorities (${this.profile.interests?.[0] || 'focus'} vs ${otherAgent.profile.interests?.[0] || 'focus'}).`
      };
    }
  }

  /**
   * Computes an interaction chemistry score based on inspection and dialogue coherence.
   */
  scoreInteraction(inspection, proposalAccepted) {
    let score = 50;
    score += Math.min(30, inspection.sharedInterests.length * 10);
    score += Math.min(15, inspection.sharedHobbies.length * 8);
    score += Math.min(10, inspection.workSynergy.length * 5);
    if (proposalAccepted) score += 5;
    score -= inspection.frictionPoints.length * 10;
    return Math.max(35, Math.min(96, score));
  }
}

/**
 * Deterministic, profile-grounded multi-turn dating harness between two agents.
 */
export function simulateAgentDate(personA, personB) {
  const agentA = new DatingAgent(personA);
  const agentB = new DatingAgent(personB);

  const inspectA = agentA.inspect(agentB);
  const inspectB = agentB.inspect(agentA);

  const sharedTopic = inspectA.sharedInterests[0] || inspectA.sharedHobbies[0] || 'Technology & Innovation';
  const proposalA = agentA.proposeDate(inspectA);
  const evalB = agentB.evaluateProposal(proposalA, inspectB);

  const chemistryScore = agentA.scoreInteraction(inspectA, evalB.accept);
  const decisionA = agentA.finalizeDate(agentB, inspectA, chemistryScore);
  const decisionB = agentB.finalizeDate(agentA, inspectB, chemistryScore);

  let turns = [];

  if (chemistryScore >= 65 && inspectA.frictionPoints.length === 0) {
    // TEMPLATE 1: High Synergy / Mutual Alignment
    turns = [
      {
        agent: agentA.name,
        type: 'speak',
        text: `Hello ${agentB.name}. I noticed your deep involvement in ${sharedTopic}. In your day-to-day, does that remain purely professional or does it shape how you view everything?`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `${agentA.name} zeroed straight in on ${sharedTopic}. That immediate focus demonstrates high intellectual agency.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `It completely shapes how I see everything. When you spend years building around ${sharedTopic}, it becomes your default lens. What specifically caught your attention about my approach?`
      },
      {
        agent: agentA.name,
        type: 'think',
        text: `Clear, grounded response with no pretense. Our operating rhythms and priorities are exceptionally well aligned.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: proposalA.pitch
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `${evalB.reaction}. Let's do exactly that at ${proposalA.venue}.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `Fantastic. For me, the best dates are ones where both people leave with clearer thinking and mutual energy.`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `Genuine mutual respect and shared cadence. The chemistry here is grounded in shared reality, not social performance.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `Agreed 100%. Looking forward to an inspiring, high-bandwidth conversation at ${proposalA.venue}.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `See you there. It's going to be a great session.`
      }
    ];
  } else if (chemistryScore >= 50) {
    // TEMPLATE 2: Moderate Compatibility / Pragmatic Counter-Proposal
    turns = [
      {
        agent: agentA.name,
        type: 'speak',
        text: `Hi ${agentB.name}. Reviewing your background, I was curious how you balance ${agentB.profile.work_style?.[0] || 'work'} with interests like ${sharedTopic}.`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `${agentA.name} is probing my work-life boundaries early. Good to see they care about real lifestyle alignment.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `It's an ongoing discipline. I try to protect blocks of time for focused exploration, though active commitments demand a lot of bandwidth.`
      },
      {
        agent: agentA.name,
        type: 'think',
        text: `They are realistic about their bandwidth. A lighter initial format makes the most sense to test compatibility.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: proposalA.pitch
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: evalB.modification
          ? `${evalB.reaction}. Could we adjust it slightly: ${evalB.modification}?`
          : `${evalB.reaction}. Sounds like a solid plan.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `That counter-proposal makes total sense. Keeping the initial threshold low lets us test the natural flow of conversation.`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `They took the modification gracefully without ego. That indicates emotional maturity and adaptability.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `Appreciate the flexibility. Let's do that and see where the conversation leads.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `Sounds like a deal. Looking forward to our discussion.`
      }
    ];
  } else {
    // TEMPLATE 3: Divergent Signals / Honest Friction Evaluation
    turns = [
      {
        agent: agentA.name,
        type: 'speak',
        text: `Hello ${agentB.name}. Looking over our public work, our primary domains (${agentA.profile.interests?.[0] || 'Domain A'} vs ${agentB.profile.interests?.[0] || 'Domain B'}) seem quite distinct. How do you usually approach cross-domain connections?`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `${agentA.name} noticed the divergence in our focus areas right away. Better to be direct than feign artificial common ground.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `I appreciate cross-pollination, but my current focus is very deep in my specific field. If there isn't natural day-to-day overlap, finding sustained common ground can take extra effort.`
      },
      {
        agent: agentA.name,
        type: 'think',
        text: `Clear divergence in immediate trajectory. While I respect their domain, our day-to-day wavelengths differ significantly.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `I agree with your candor. We could still try ${proposalA.activity} at ${proposalA.venue} if you'd like a casual conversation.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `I appreciate the invitation, but given our different trajectories right now, I think our time might be better spent focusing on our respective core pursuits.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `Completely understand and respect that honesty. It saves both of us from an unaligned second date.`
      },
      {
        agent: agentB.name,
        type: 'think',
        text: `Handled with clarity and zero awkwardness. Clean boundaries lead to the best outcomes.`
      },
      {
        agent: agentB.name,
        type: 'speak',
        text: `Wishing you all the best with your ongoing projects.`
      },
      {
        agent: agentA.name,
        type: 'speak',
        text: `Thank you ${agentB.name}, wishing you continued success as well.`
      }
    ];
  }

  return {
    agent_a: agentA.name,
    agent_b: agentB.name,
    venue: proposalA.venue,
    activity: proposalA.activity,
    shared_interest: sharedTopic,
    turns,
    decision_a: decisionA,
    decision_b: decisionB,
    chemistry_score: chemistryScore,
    disclaimer: 'Simulated agent dialogue — not statements made by either real person.'
  };
}

export async function analyzePerson(person) {
  return analyzePersonLocally(person);
}

export async function generateDateDialogue(personA, personB) {
  return simulateAgentDate(personA, personB);
}
