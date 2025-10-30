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
    async getPlans() {
        const Storage = window.CapacitorBridge?.Storage || {
            get: (key) => Promise.resolve(localStorage.getItem(key))
        };
        const plans = await Storage.get(this.storageKey);
        return plans ? JSON.parse(plans) : {};
    }

    // Get active plan ID
    async getActivePlanId() {
        const Storage = window.CapacitorBridge?.Storage || {
            get: (key) => Promise.resolve(localStorage.getItem(key))
        };
        return (await Storage.get(this.activeKey)) || 'default';
    }

    // Set active plan
    async setActivePlan(planId) {
        const Storage = window.CapacitorBridge?.Storage || {
            set: (key, value) => { localStorage.setItem(key, value); return Promise.resolve(); }
        };
        await Storage.set(this.activeKey, planId);
    }

    // Get active plan
    async getActivePlan() {
        const plans = await this.getPlans();
        const activePlanId = await this.getActivePlanId();

        if (!plans[activePlanId]) {
            // Create default plan if it doesn't exist
            plans[activePlanId] = {
                id: activePlanId,
                name: 'My Study Plan',
                problems: [],
                createdAt: new Date().toISOString()
            };
            await this.savePlans(plans);
        }

        return plans[activePlanId];
    }

    // Save all plans
    async savePlans(plans) {
        const Storage = window.CapacitorBridge?.Storage || {
            set: (key, value) => { localStorage.setItem(key, value); return Promise.resolve(); }
        };
        await Storage.set(this.storageKey, JSON.stringify(plans));
    }

    // Create new plan
    async createPlan(name) {
        const plans = await this.getPlans();
        const planId = 'plan_' + Date.now();

        plans[planId] = {
            id: planId,
            name: name || 'New Study Plan',
            problems: [],
            createdAt: new Date().toISOString()
        };

        await this.savePlans(plans);
        await this.setActivePlan(planId);
        return planId;
    }

    // Delete plan
    async deletePlan(planId) {
        const plans = await this.getPlans();
        delete plans[planId];
        await this.savePlans(plans);

        // If deleted plan was active, switch to another existing plan
        if ((await this.getActivePlanId()) === planId) {
            const remainingPlans = Object.keys(plans);
            if (remainingPlans.length > 0) {
                // Switch to the first remaining plan
                await this.setActivePlan(remainingPlans[0]);
            } else {
                // No plans left, create a new default plan
                const newPlanId = await this.createPlan('My Study Plan');
                // createPlan already sets it as active
            }
        }
    }

    // Rename plan
    async renamePlan(planId, newName) {
        const plans = await this.getPlans();
        if (plans[planId]) {
            plans[planId].name = newName;
            await this.savePlans(plans);
        }
    }

    // Check if problem is in active plan
    // Supports both old format (just number) and new format ({testFile, problemNumber})
    async isProblemInPlan(problemNumber, testFile = null) {
        const plan = await this.getActivePlan();
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
    async addProblem(problemNumber, testFile = 'amc_2012_10a_problems.json') {
        const plans = await this.getPlans();
        const activePlanId = await this.getActivePlanId();
        const plan = plans[activePlanId];

        // Check if already exists
        if (await this.isProblemInPlan(problemNumber, testFile)) {
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

        await this.savePlans(plans);
        return true;
    }

    // Remove problem from active plan
    async removeProblem(problemNumber, testFile = null) {
        const plans = await this.getPlans();
        const activePlanId = await this.getActivePlanId();
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
            await this.savePlans(plans);
            return true;
        }
        return false;
    }

    // Toggle problem in active plan
    async toggleProblem(problemNumber, testFile = 'amc_2012_10a_problems.json') {
        if (await this.isProblemInPlan(problemNumber, testFile)) {
            await this.removeProblem(problemNumber, testFile);
            return false;
        } else {
            await this.addProblem(problemNumber, testFile);
            return true;
        }
    }

    // Get problem count for active plan
    async getProblemCount() {
        const plan = await this.getActivePlan();
        return plan.problems.length;
    }
}

// Create global instance
window.studyPlanManager = new StudyPlanManager();
