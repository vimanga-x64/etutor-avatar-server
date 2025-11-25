import { Document, NodeIO } from '@gltf-transform/core';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function inspectGLB() {
    const io = new NodeIO();
    const glbPath = path.join(__dirname, 'public', 'models', 'avatar_female.glb');
    
    console.log(`\nInspecting: ${glbPath}\n`);
    
    try {
        const document = await io.read(glbPath);
        const root = document.getRoot();
        
        console.log('=== MESHES ===');
        const meshes = root.listMeshes();
        console.log(`Total meshes: ${meshes.length}`);
        
        meshes.forEach((mesh, i) => {
            const name = mesh.getName() || `Mesh_${i}`;
            const primitives = mesh.listPrimitives();
            
            console.log(`\n[${i}] ${name}`);
            console.log(`    Primitives: ${primitives.length}`);
            
            primitives.forEach((prim, j) => {
                const targets = prim.listTargets();
                const semantics = prim.listSemantics();
                
                console.log(`    Primitive ${j}:`);
                console.log(`      Attributes: ${semantics.join(', ')}`);
                console.log(`      Morph Targets: ${targets.length}`);
                
                if (targets.length > 0) {
                    console.log('      TARGET DETAILS:');
                    targets.forEach((target, k) => {
                        const targetSemantics = target.listSemantics();
                        console.log(`        [${k}] attributes: ${targetSemantics.join(', ')}`);
                    });
                }
            });
        });
        
        console.log('\n=== ANIMATIONS ===');
        const animations = root.listAnimations();
        console.log(`Total animations: ${animations.length}`);
        animations.forEach((anim, i) => {
            console.log(`  [${i}] ${anim.getName() || 'unnamed'}`);
        });
        
        console.log('\n=== MATERIALS ===');
        const materials = root.listMaterials();
        console.log(`Total materials: ${materials.length}`);
        materials.forEach((mat, i) => {
            console.log(`  [${i}] ${mat.getName() || 'unnamed'}`);
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

inspectGLB();
