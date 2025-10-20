/**
 * Study Plan Management
 * Handles creating, updating, and managing multiple study plans
 */

class StudyPlanManager {
    constructor() {
        this.storageKey = 'amc_study_plans';
        this.activeKey = 'amc_active_plan';
    }

    // Get all study plans
    getPlans() {
        const plans = localStorage.getItem(this.storageKey);
        return plans ? JSON.parse(plans) : {};
    }

    // Get active plan ID
    getActivePlanId() {
        return localStorage.getItem(this.activeKey) || 'default';
    }

    // Set active plan
    setActivePlan(planId) {
        localStorage.setItem(this.activeKey, planId);
    }

    // Get active plan
    getActivePlan() {
        const plans = this.getPlans();
        const activePlanId = this.getActivePlanId();

        if (!plans[activePlanId]) {
            // Create default plan if it doesn't exist
            plans[activePlanId] = {
                id: activePlanId,
                name: 'My Study Plan',
                problems: [],
                createdAt: new Date().toISOString()
            };
            this.savePlans(plans);
        }

        return plans[activePlanId];
    }

    // Save all plans
    savePlans(plans) {
        localStorage.setItem(this.storageKey, JSON.stringify(plans));
    }

    // Create new plan
    createPlan(name) {
        const plans = this.getPlans();
        const planId = 'plan_' + Date.now();

        plans[planId] = {
            id: planId,
            name: name || 'New Study Plan',
            problems: [],
            createdAt: new Date().toISOString()
        };

        this.savePlans(plans);
        this.setActivePlan(planId);
        return planId;
    }

    // Delete plan
    deletePlan(planId) {
        const plans = this.getPlans();
        delete plans[planId];
        this.savePlans(plans);

        // If deleted plan was active, switch to default
        if (this.getActivePlanId() === planId) {
            this.setActivePlan('default');
        }
    }

    // Rename plan
    renamePlan(planId, newName) {
        const plans = this.getPlans();
        if (plans[planId]) {
            plans[planId].name = newName;
            this.savePlans(plans);
        }
    }

    // Check if problem is in active plan
    isProblemInPlan(problemNumber) {
        const plan = this.getActivePlan();
        return plan.problems.includes(problemNumber);
    }

    // Add problem to active plan
    addProblem(problemNumber) {
        const plans = this.getPlans();
        const activePlanId = this.getActivePlanId();
        const plan = plans[activePlanId];

        if (!plan.problems.includes(problemNumber)) {
            plan.problems.push(problemNumber);
            plan.problems.sort((a, b) => a - b); // Keep sorted
            this.savePlans(plans);
            return true;
        }
        return false;
    }

    // Remove problem from active plan
    removeProblem(problemNumber) {
        const plans = this.getPlans();
        const activePlanId = this.getActivePlanId();
        const plan = plans[activePlanId];

        const index = plan.problems.indexOf(problemNumber);
        if (index > -1) {
            plan.problems.splice(index, 1);
            this.savePlans(plans);
            return true;
        }
        return false;
    }

    // Toggle problem in active plan
    toggleProblem(problemNumber) {
        if (this.isProblemInPlan(problemNumber)) {
            this.removeProblem(problemNumber);
            return false;
        } else {
            this.addProblem(problemNumber);
            return true;
        }
    }

    // Get problem count for active plan
    getProblemCount() {
        const plan = this.getActivePlan();
        return plan.problems.length;
    }
}

// Create global instance
window.studyPlanManager = new StudyPlanManager();
