/**
 * Smart Windows packaging script
 * Automatically falls back to unsigned build if code signing fails
 */

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const mergedEnv = { ...process.env, ...env };
    
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: path.join(__dirname, '..'),
      env: mergedEnv
    });

    let errorOutput = '';

    proc.on('error', (error) => {
      reject(error);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

async function buildWithSigning() {
  log('🔐 Attempting build with code signing...', 'cyan');
  await runCommand('npx', ['electron-builder', '--win']);
}

async function buildWithoutSigning() {
  log('📦 Building without code signing...', 'yellow');
  await runCommand('npx', [
    'electron-builder',
    '--win',
    '--config.win.signAndEditExecutable=false'
  ], {
    CSC_IDENTITY_AUTO_DISCOVERY: 'false'
  });
}

async function main() {
  log('', 'reset');
  log('╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║        PromptX Windows Packaging Script                  ║', 'cyan');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');
  log('', 'reset');

  // Check if --unsigned flag is passed
  const forceUnsigned = process.argv.includes('--unsigned');
  
  // Check if --signed flag is passed (fail if signing fails)
  const forceSigned = process.argv.includes('--signed');

  if (forceUnsigned) {
    log('⚡ Unsigned mode requested via --unsigned flag', 'yellow');
    try {
      await buildWithoutSigning();
      log('', 'reset');
      log('✅ Build completed successfully (unsigned)', 'green');
      log('⚠️  Note: Windows may show "Unknown Publisher" warning during installation', 'yellow');
      return;
    } catch (error) {
      log(`❌ Build failed: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  // Try signed build first
  try {
    await buildWithSigning();
    log('', 'reset');
    log('✅ Build completed successfully (signed)', 'green');
    return;
  } catch (signedError) {
    log('', 'reset');
    log('⚠️  Signed build failed', 'yellow');
    
    if (forceSigned) {
      log('❌ --signed flag specified, not falling back to unsigned build', 'red');
      process.exit(1);
    }

    log('🔄 Automatically falling back to unsigned build...', 'cyan');
    log('', 'reset');

    try {
      await buildWithoutSigning();
      log('', 'reset');
      log('✅ Build completed successfully (unsigned)', 'green');
      log('', 'reset');
      log('💡 Tips:', 'dim');
      log('   • Windows may show "Unknown Publisher" warning during installation', 'dim');
      log('   • For production releases, consider purchasing a code signing certificate', 'dim');
      log('   • To skip signing attempts, use: pnpm package:win --unsigned', 'dim');
    } catch (unsignedError) {
      log('', 'reset');
      log('❌ Build failed even without signing', 'red');
      log(`   Error: ${unsignedError.message}`, 'red');
      process.exit(1);
    }
  }
}

main().catch((error) => {
  log(`❌ Unexpected error: ${error.message}`, 'red');
  process.exit(1);
});
