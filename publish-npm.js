#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// NPM registries to publish to
const registries = [
    {
        name: 'npm',
        url: 'https://registry.npmjs.org/',
        description: 'Official NPM Registry'
    },
    {
        name: 'GitHub',
        url: 'https://npm.pkg.github.com/',
        description: 'GitHub Package Registry',
        scope: '@webrtc-dashjs'
    }
];

// Function to execute command and handle errors
function exec(command, options = {}) {
    try {
        console.log(`Running: ${command}`);
        const result = execSync(command, { stdio: 'inherit', ...options });
        return true;
    } catch (error) {
        console.error(`Error executing: ${command}`);
        console.error(error.message);
        return false;
    }
}

// Function to check if user is logged in to a registry
function checkAuth(registry) {
    try {
        execSync(`npm whoami --registry ${registry.url}`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

// Main publish function
async function publishPackage() {
    console.log('🚀 Starting NPM package publishing process...\n');
    
    // Check if dist folder exists
    if (!fs.existsSync(path.join(__dirname, 'dist'))) {
        console.log('📦 Building package first...');
        if (!exec('npm run build')) {
            console.error('❌ Build failed. Aborting publish.');
            process.exit(1);
        }
    }
    
    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`\n📋 Publishing: ${packageJson.name}@${packageJson.version}\n`);
    
    // Publish to each registry
    const publishResults = [];
    
    for (const registry of registries) {
        console.log(`\n🔄 Publishing to ${registry.name} (${registry.url})...`);
        
        // Check authentication
        if (!checkAuth(registry)) {
            console.log(`⚠️  Not logged in to ${registry.name}. Skipping...`);
            console.log(`   To login: npm login --registry ${registry.url}`);
            if (registry.scope) {
                console.log(`   You may also need to configure scope: npm config set ${registry.scope}:registry ${registry.url}`);
            }
            publishResults.push({ registry: registry.name, status: 'skipped', reason: 'not authenticated' });
            continue;
        }
        
        // Attempt to publish
        let publishCommand = `npm publish --registry ${registry.url}`;
        
        // Add scope if specified
        if (registry.scope && !packageJson.name.startsWith(registry.scope)) {
            // Create a temporary package.json with scoped name
            const scopedPackageJson = { ...packageJson, name: `${registry.scope}/${packageJson.name}` };
            fs.writeFileSync('package.json.tmp', JSON.stringify(scopedPackageJson, null, 2));
            
            // Publish with scoped name
            const success = exec(`npm publish --registry ${registry.url}`);
            
            // Restore original package.json
            fs.renameSync('package.json', 'package.json.backup');
            fs.renameSync('package.json.tmp', 'package.json');
            
            if (success) {
                publishResults.push({ registry: registry.name, status: 'success' });
                console.log(`✅ Successfully published to ${registry.name}`);
            } else {
                publishResults.push({ registry: registry.name, status: 'failed' });
                console.log(`❌ Failed to publish to ${registry.name}`);
            }
            
            // Restore backup
            fs.renameSync('package.json', 'package.json.tmp');
            fs.renameSync('package.json.backup', 'package.json');
            fs.unlinkSync('package.json.tmp');
        } else {
            // Normal publish
            if (exec(publishCommand)) {
                publishResults.push({ registry: registry.name, status: 'success' });
                console.log(`✅ Successfully published to ${registry.name}`);
            } else {
                publishResults.push({ registry: registry.name, status: 'failed' });
                console.log(`❌ Failed to publish to ${registry.name}`);
            }
        }
    }
    
    // Summary
    console.log('\n\n📊 Publishing Summary:');
    console.log('=======================');
    publishResults.forEach(result => {
        const icon = result.status === 'success' ? '✅' : result.status === 'failed' ? '❌' : '⚠️';
        console.log(`${icon} ${result.registry}: ${result.status}${result.reason ? ` (${result.reason})` : ''}`);
    });
    
    const successCount = publishResults.filter(r => r.status === 'success').length;
    if (successCount > 0) {
        console.log(`\n🎉 Package published to ${successCount} registr${successCount === 1 ? 'y' : 'ies'}!`);
        console.log(`\nInstall with: npm install ${packageJson.name}`);
    } else {
        console.log('\n⚠️  Package was not published to any registry.');
        console.log('Please check authentication and try again.');
    }
}

// Run the publish process
publishPackage().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});