import express from 'express';
import cors from 'cors';
import solc from 'solc';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const NODE_ENV = process.env.NODE_ENV || 'development';

// CORS configuration - More flexible for production
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, postman)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            FRONTEND_URL,
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000'
        ];
        
        // In production, also allow all Vercel preview URLs
        if (NODE_ENV === 'production' && origin.includes('.vercel.app')) {
            return callback(null, true);
        }
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn(`⚠️ CORS blocked request from: ${origin}`);
            console.log(`✅ Allowed origins:`, allowedOrigins);
            callback(null, true); // For hackathon, allow all
        }
    },
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        environment: NODE_ENV,
        message: NODE_ENV === 'production'
            ? 'Backend is running. File operations disabled in production.'
            : 'Backend is running in development mode.',
        timestamp: new Date().toISOString()
    });
});

// API Info endpoint
app.get('/api/info', (req, res) => {
    res.json({
        name: 'CREator Backend API',
        version: '1.0.0',
        environment: NODE_ENV,
        orchestratorPath: ORCHESTRATOR_PATH,
        availableEndpoints: ['/health', '/api/info', '/api/write-file', '/api/simulate', '/api/get-env-config', '/api/set-env-config'],
        availableRoutes: ['/health', '/api/info', '/api/write-file', '/api/simulate', '/api/get-env-config', '/api/set-env-config']
    });
});

// ============================================================================
// HACKATHON MODE: Full functionality enabled in all environments
// ============================================================================
// Import server with full functionality
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const execAsync = promisify(exec);

// Docker uses /cre-orchestrator, local dev uses ../cre-orchestrator relative to backend
const ORCHESTRATOR_PATH = process.env.ORCHESTRATOR_PATH || path.resolve(__dirname, '..', 'cre-orchestrator');
const CRE_ENV_PATH = path.join(ORCHESTRATOR_PATH, '.env');

// Initialize .env file if it doesn't exist (for production)
async function initializeEnvFile() {
    try {
        await fs.access(CRE_ENV_PATH);
        console.log('✓ .env file found in orchestrator');
    } catch {
        console.log('⚠️ .env file not found, creating with default values...');
        try {
            // Create .env with values from environment variables or defaults
            // Private key is optional - CRE can run simulations without it for basic workflows
            const privateKey = process.env.CRE_ETH_PRIVATE_KEY || '';
            const target = process.env.CRE_TARGET || 'staging-settings';
            
            const envContent = `# CRE Configuration
# Generated automatically by CREator Backend
# Private key is optional - some simulations work without it
CRE_ETH_PRIVATE_KEY=${privateKey}
CRE_TARGET=${target}
`;
            await fs.writeFile(CRE_ENV_PATH, envContent, 'utf-8');
            console.log('✓ .env file created');
            
            if (!privateKey) {
                console.log('ℹ️ Note: CRE_ETH_PRIVATE_KEY not set - some workflows may require it');
                console.log('   Users can configure their key via Settings in the frontend');
                console.log('   Many simulations work without a key!');
            }
        } catch (error) {
            console.error('❌ Failed to create .env file:', error);
        }
    }
}

// Initialize on startup
initializeEnvFile();

// Write file endpoint
app.post('/api/write-file', async (req, res) => {
    try {
        const { path: relativePath, content } = req.body;

        if (!relativePath || content === undefined) {
            return res.status(400).json({ error: 'Missing path or content' });
        }

        // Always use ORCHESTRATOR_PATH from environment or default
        const filePath = path.join(ORCHESTRATOR_PATH, relativePath);
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, 'utf-8');

        console.log(`✓ File written: ${filePath}`);
        res.json({ success: true, message: `File written: ${filePath}` });
    } catch (error) {
        console.error('Error writing file:', error);
        res.status(500).json({
            error: 'Failed to write file',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Simulate workflow endpoint
app.post('/api/simulate', async (req, res) => {
    try {
        // Always use ORCHESTRATOR_PATH from environment or default
        // Ignore the orchestratorPath from request body
        console.log(`📍 Using orchestrator path: ${ORCHESTRATOR_PATH}`);
        
        // Use the full path to workflows directory
        const workflowsPath = path.join(ORCHESTRATOR_PATH, 'workflows');
        console.log(`🔍 Workflows path: ${workflowsPath}`);
        
        // Command: Use CRE CLI installed from https://cre.chain.link/install.sh
        // The CLI gets installed to $HOME/.cre/bin/cre in Render
        // We try multiple possible locations
        const creCommand = process.env.HOME 
            ? `${process.env.HOME}/.cre/bin/cre` 
            : 'cre'; // fallback to global cre if HOME not set
            
        const command = `cd "${ORCHESTRATOR_PATH}" && ${creCommand} workflow simulate workflows --target=staging-settings`;
        const isWindows = process.platform === 'win32';
        
        console.log(`🚀 Executing: ${command}`);

        const { stdout, stderr } = await execAsync(command, {
            shell: isWindows ? 'powershell.exe' : '/bin/sh',
            maxBuffer: 1024 * 1024 * 10,
            timeout: 60000,
        });

        const output = stdout + (stderr ? '\n' + stderr : '');

        res.json({
            success: true,
            output: output,
        });
    } catch (error) {
        console.error('Error running simulation:', error);

        const execError = error as { stdout?: string; stderr?: string; message?: string };
        const errorOutput = (execError.stdout || '') + '\n' + (execError.stderr || '') + '\n' + (execError.message || '');

        // Check if the error is due to authentication (cre login required)
        if (errorOutput.includes('not logged in') || errorOutput.includes('authentication required') || errorOutput.includes('run cre login')) {
            const message = `
⚠️ CRE CLI Authentication Required

The Chainlink CRE CLI requires authentication via 'cre login' before running simulations.
This is a limitation of running CRE in a hosted environment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 SOLUTION: Use "Export Flow" Instead
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Click the "💾 Export Flow" button above
2. Download the complete CRE project (ZIP file)
3. Extract and follow the QUICKSTART.md guide
4. Run 'cre login' once on your local machine
5. Test your workflow with full CRE CLI capabilities

This approach gives you:
✅ Full CRE CLI functionality
✅ Real testnet/mainnet testing
✅ Complete control over your private keys
✅ Professional deployment workflow

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The visual workflow builder and Export functionality work perfectly!
This is the recommended approach for production use. 🚀
`;
            
            res.json({
                success: false,
                output: message,
                authError: true
            });
        } else {
            // Other errors - return as-is
            res.json({
                success: false,
                output: errorOutput,
            });
        }
    }
});

// Get environment configuration status
app.get('/api/get-env-config', async (req, res) => {
    try {
        const envContent = await fs.readFile(CRE_ENV_PATH, 'utf-8');
        
        // Check if private key exists and is not empty/placeholder
        const keyMatch = envContent.match(/CRE_ETH_PRIVATE_KEY=(.+)/);
        const hasValidKey = keyMatch && 
            keyMatch[1].trim() !== '' && 
            !keyMatch[1].includes('your_') &&
            !keyMatch[1].includes('placeholder');

        res.json({
            configured: !!hasValidKey,
            hasPrivateKey: !!hasValidKey,
            path: CRE_ENV_PATH,
            note: hasValidKey ? undefined : 'No private key configured. Some workflows may work without it.'
        });
    } catch (error) {
        res.json({
            configured: false,
            hasPrivateKey: false,
            error: 'Could not read .env file',
            note: 'Configure via Settings if needed for your workflow'
        });
    }
});

// Set environment configuration
app.post('/api/set-env-config', async (req, res) => {
    try {
        const { privateKey } = req.body;

        if (!privateKey) {
            return res.status(400).json({ error: 'Missing privateKey' });
        }

        const cleanKey = privateKey.replace(/^0x/, '').trim();

        if (!/^[a-fA-F0-9]{64}$/.test(cleanKey)) {
            return res.status(400).json({
                error: 'Invalid private key format. Must be 64 hexadecimal characters.'
            });
        }

        const envContent = `CRE_ETH_PRIVATE_KEY=${cleanKey}\nCRE_TARGET=staging-settings\n`;
        await fs.writeFile(CRE_ENV_PATH, envContent, 'utf-8');

        res.json({
            success: true,
            message: 'Private key configured successfully'
        });
    } catch (error) {
        console.error('Error setting env config:', error);
        res.status(500).json({
            error: 'Failed to save configuration',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

console.log('🧪 CREator Backend running in HACKATHON mode');
console.log('✅ All file operations are ENABLED');
console.log(`📁 Orchestrator path: ${ORCHESTRATOR_PATH}`);

// Compile Solidity contract endpoint
app.post('/api/compile', async (req, res) => {
    try {
        const { sourceCode } = req.body;

        if (!sourceCode || typeof sourceCode !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid sourceCode' });
        }

        // Create compiler input
        const input = {
            language: 'Solidity',
            sources: {
                'Contract.sol': { content: sourceCode }
            },
            settings: {
                outputSelection: {
                    '*': {
                        '*': ['abi', 'evm.bytecode.object']
                    }
                },
                optimizer: {
                    enabled: true,
                    runs: 200
                }
            }
        };

        // Compile
        const output = JSON.parse(solc.compile(JSON.stringify(input)));

        // Check for errors
        if (output.errors) {
            const hasError = output.errors.some((err: any) => err.severity === 'error');
            if (hasError) {
                return res.json({
                    success: false,
                    errors: output.errors
                });
            }
        }

        // Extract result
        const contractFile = output.contracts['Contract.sol'];
        const contractName = Object.keys(contractFile)[0];
        const contract = contractFile[contractName];

        res.json({
            success: true,
            result: {
                abi: contract.abi,
                bytecode: '0x' + contract.evm.bytecode.object
            }
        });

    } catch (error) {
        console.error('Compilation error:', error);
        res.status(500).json({
            error: 'Compilation failed',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} does not exist`,
        availableRoutes: NODE_ENV === 'production'
            ? ['/health', '/api/info', '/api/compile']
            : ['/health', '/api/info', '/api/write-file', '/api/simulate', '/api/get-env-config', '/api/set-env-config', '/api/compile']
    });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: NODE_ENV === 'development' ? err.message : 'An error occurred'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔗 CREator Backend API`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📍 Server: http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${NODE_ENV}`);
    console.log(`🎯 CORS Origin: ${FRONTEND_URL}`);
    console.log(`📁 Orchestrator: ${ORCHESTRATOR_PATH}`);
    console.log(`⏰ Started: ${new Date().toISOString()}`);
    console.log(`${'='.repeat(60)}\n`);
});

export default app;
