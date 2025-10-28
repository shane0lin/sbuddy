/**
 * API Adapter for AMC Problems Viewer
 * Provides a unified interface for both API and file-based data access
 */

class AMCDataAdapter {
    constructor() {
        this.useAPI = true; // Default to API mode
        this.initialized = false;
    }

    /**
     * Initialize and detect data source
     */
    async init() {
        if (this.initialized) return;

        this.useAPI = await shouldUseAPI();
        this.initialized = true;

        console.log(`AMC Data Adapter initialized in ${this.useAPI ? 'API' : 'FILE'} mode`);
    }

    /**
     * Get list of available tests
     */
    async getTests() {
        await this.init();

        if (this.useAPI) {
            return this._getTestsFromAPI();
        } else {
            return this._getTestsFromFiles();
        }
    }

    /**
     * Get problems for a specific test
     */
    async getTestProblems(year, variant) {
        await this.init();

        if (this.useAPI) {
            return this._getTestProblemsFromAPI(year, variant);
        } else {
            return this._getTestProblemsFromFiles(year, variant);
        }
    }

    /**
     * Get a single problem by ID
     */
    async getProblem(id) {
        await this.init();

        if (this.useAPI) {
            return this._getProblemFromAPI(id);
        } else {
            // File mode doesn't support ID lookup - would need to load entire test
            throw new Error('Problem lookup by ID not supported in file mode');
        }
    }

    /**
     * Search problems
     */
    async searchProblems(query, filters = {}) {
        await this.init();

        if (this.useAPI) {
            return this._searchProblemsFromAPI(query, filters);
        } else {
            // File mode doesn't support search
            throw new Error('Search not supported in file mode');
        }
    }

    // ===== API Methods =====

    async _getTestsFromAPI() {
        try {
            const response = await fetch(getApiUrl('/index'));
            const data = await response.json();

            return {
                generatedAt: data.generatedAt,
                totalTests: data.totalTests,
                tests: data.tests.map(test => ({
                    year: test.year,
                    variant: test.variant,
                    test: test.test,
                    problemCount: test.problemCount,
                    source: test.source,
                    // Create virtual file path for compatibility
                    filePath: null
                }))
            };
        } catch (error) {
            console.error('Error fetching tests from API:', error);
            throw error;
        }
    }

    async _getTestProblemsFromAPI(year, variant) {
        try {
            const response = await fetch(getApiUrl(`/tests/${year}/${variant}`));
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch problems');
            }

            return {
                metadata: data.metadata,
                problems: data.problems
            };
        } catch (error) {
            console.error('Error fetching test problems from API:', error);
            throw error;
        }
    }

    async _getProblemFromAPI(id) {
        try {
            const response = await fetch(getApiUrl(`/problems/${id}`));
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch problem');
            }

            return data.problem;
        } catch (error) {
            console.error('Error fetching problem from API:', error);
            throw error;
        }
    }

    async _searchProblemsFromAPI(query, filters = {}) {
        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (filters.year) params.append('year', filters.year);
            if (filters.difficulty) params.append('difficulty', filters.difficulty);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.offset) params.append('offset', filters.offset);

            const response = await fetch(getApiUrl(`/search?${params.toString()}`));
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to search problems');
            }

            return data.problems;
        } catch (error) {
            console.error('Error searching problems from API:', error);
            throw error;
        }
    }

    // ===== File Methods =====

    async _getTestsFromFiles() {
        try {
            const response = await fetch(VIEWER_CONFIG.FILE_INDEX_PATH);
            const indexData = await response.json();
            return indexData;
        } catch (error) {
            console.error('Error loading index from files:', error);
            throw error;
        }
    }

    async _getTestProblemsFromFiles(year, variant) {
        try {
            // Find the test in the index
            const index = await this._getTestsFromFiles();
            const test = index.tests.find(t =>
                t.year === parseInt(year) && t.variant === variant.toUpperCase()
            );

            if (!test || !test.filePath) {
                throw new Error(`Test not found: ${year} AMC 10${variant}`);
            }

            // Load the test file
            const response = await fetch(`../../${test.filePath}`);
            const data = await response.json();

            return {
                metadata: data.metadata,
                problems: data.problems
            };
        } catch (error) {
            console.error('Error loading test from files:', error);
            throw error;
        }
    }
}

// Create global instance
const amcData = new AMCDataAdapter();
