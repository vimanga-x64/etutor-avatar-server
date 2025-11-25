// Test script to check morph target names in GLB
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We can't run Three.js directly in Node, but we can check the raw GLB JSON
// Let's parse the binary to extract the JSON chunk

async function extractGLBJson() {
    const glbPath = path.join(__dirname, 'public', 'models', 'avatar_female.glb');
    const buffer = fs.readFileSync(glbPath);
    
    // GLB format:
    // - 12 byte header (magic, version, length)
    // - Chunks
    
    const magic = buffer.readUInt32LE(0);
    const version = buffer.readUInt32LE(4);
    const length = buffer.readUInt32LE(8);
    
    console.log(`Magic: 0x${magic.toString(16)} (should be 0x46546C67 for "glTF")`);
    console.log(`Version: ${version}`);
    console.log(`Total Length: ${length} bytes`);
    
    // First chunk (JSON)
    const chunkLength = buffer.readUInt32LE(12);
    const chunkType = buffer.readUInt32LE(16);
    
    console.log(`\nFirst chunk type: 0x${chunkType.toString(16)} (should be 0x4E4F534A for JSON)`);
    console.log(`JSON chunk length: ${chunkLength} bytes`);
    
    // Extract JSON
    const jsonChunk = buffer.slice(20, 20 + chunkLength).toString('utf8');
    const gltf = JSON.parse(jsonChunk);
    
    console.log('\n=== MESH EXTRAS ===');
    if (gltf.meshes) {
        gltf.meshes.forEach((mesh, i) => {
            console.log(`\nMesh ${i}: ${mesh.name}`);
            if (mesh.extras) {
                console.log('  Extras:', JSON.stringify(mesh.extras, null, 2));
            }
            if (mesh.primitives) {
                mesh.primitives.forEach((prim, j) => {
                    if (prim.targets) {
                        console.log(`  Primitive ${j}: ${prim.targets.length} morph targets`);
                    }
                });
            }
            if (mesh.weights) {
                console.log(`  Default weights: [${mesh.weights.slice(0, 5).join(', ')}...]`);
            }
        });
    }
    
    console.log('\n=== TARGET NAMES ===');
    // Morph target names are usually in mesh.extras.targetNames
    if (gltf.meshes) {
        gltf.meshes.forEach((mesh, i) => {
            if (mesh.extras && mesh.extras.targetNames) {
                console.log(`\nMesh "${mesh.name}" target names:`);
                mesh.extras.targetNames.forEach((name, j) => {
                    console.log(`  [${j}] ${name}`);
                });
            }
        });
    }
    
    // Also check accessors for names
    console.log('\n=== NODES ===');
    if (gltf.nodes) {
        gltf.nodes.forEach((node, i) => {
            if (node.mesh !== undefined || node.skin !== undefined) {
                console.log(`Node ${i}: ${node.name || 'unnamed'} (mesh: ${node.mesh}, skin: ${node.skin})`);
            }
        });
    }
}

extractGLBJson();
