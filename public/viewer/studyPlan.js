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

        // If deleted plan was active, switch to another existing plan
        if (this.getActivePlanId() === planId) {
            const remainingPlans = Object.keys(plans);
            if (remainingPlans.length > 0) {
                // Switch to the first remaining plan
                this.setActivePlan(remainingPlans[0]);
            } else {
                // No plans left, create a new default plan
                const newPlanId = this.createPlan('My Study Plan');
                // createPlan already sets it as active
            }
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
    // Supports both old format (just number) and new format ({testFile, problemNumber})
    isProblemInPlan(problemNumber, testFile = null) {
        const plan = this.getActivePlan();
        if (!plan.problems) return false;

        return plan.problems.some(p => {
            // Old format: just a number
            if (typeof p === 'number') {
                return p === problemNumber;
            }
            // New format: {testFile, problemNumber}
            if (typeof p === 'object' && p.problemNumber) {
                const numberMatch = p.problemNumber === problemNumber;
                if (!testFile) return numberMatch;
                return numberMatch && p.testFile === testFile;
            }
            return false;
        });
    }

    // Add problem to active plan (new format with testFile)
    addProblem(problemNumber, testFile = 'amc_2012_10a_problems.json') {
        const plans = this.getPlans();
        const activePlanId = this.getActivePlanId();
        const plan = plans[activePlanId];

        // Check if already exists
        if (this.isProblemInPlan(problemNumber, testFile)) {
            return false;
        }

        // Store as object with testFile and problemNumber
        plan.problems.push({ testFile, problemNumber });

        // Sort by test file then by problem number
        plan.problems.sort((a, b) => {
            const aTest = typeof a === 'object' ? a.testFile : '';
            const bTest = typeof b === 'object' ? b.testFile : '';
            const aNum = typeof a === 'object' ? a.problemNumber : a;
            const bNum = typeof b === 'object' ? b.problemNumber : b;

            if (aTest !== bTest) return aTest.localeCompare(bTest);
            return aNum - bNum;
        });

        this.savePlans(plans);
        return true;
    }

    // Remove problem from active plan
    removeProblem(problemNumber, testFile = null) {
        const plans = this.getPlans();
        const activePlanId = this.getActivePlanId();
        const plan = plans[activePlanId];

        const index = plan.problems.findIndex(p => {
            if (typeof p === 'number') {
                return p === problemNumber;
            }
            if (typeof p === 'object' && p.problemNumber) {
                const numberMatch = p.problemNumber === problemNumber;
                if (!testFile) return numberMatch;
                return numberMatch && p.testFile === testFile;
            }
            return false;
        });

        if (index > -1) {
            plan.problems.splice(index, 1);
            this.savePlans(plans);
            return true;
        }
        return false;
    }

    // Toggle problem in active plan
    toggleProblem(problemNumber, testFile = 'amc_2012_10a_problems.json') {
        if (this.isProblemInPlan(problemNumber, testFile)) {
            this.removeProblem(problemNumber, testFile);
            return false;
        } else {
            this.addProblem(problemNumber, testFile);
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
