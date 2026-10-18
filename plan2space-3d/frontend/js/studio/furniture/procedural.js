/**
 * Procedural 3D Furniture Generator for Plan2Space 3D Design Studio.
 * Builds clean, optimized Three.js primitive meshes for all 7 categories and variants.
 * Units: Strictly METRES.
 */

import * as THREE from 'three';

// Helper to create a Box Mesh with shadows and material tags
function createBox(w, h, d, material, cast = true, receive = true) {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

// Helper to create a Cylinder Mesh with shadows
function createCylinder(rt, rb, h, segs, material, cast = true, receive = true) {
  const geom = new THREE.CylinderGeometry(rt, rb, h, segs);
  const mesh = new THREE.Mesh(geom, material);
  mesh.castShadow = cast;
  mesh.receiveShadow = receive;
  return mesh;
}

/**
 * Creates a procedural Three.js Group for a given item type, variant, and colors.
 */
export function createFurnitureModel(itemType, variant, primaryHex = '#EDE6D6', secondaryHex = '#334155') {
  const group = new THREE.Group();
  group.name = `furniture:${itemType}:${variant}`;

  const matPrimary = new THREE.MeshStandardMaterial({
    color: new THREE.Color(primaryHex),
    roughness: 0.6,
    metalness: 0.1,
  });
  matPrimary.name = 'mat_primary';

  const matSecondary = new THREE.MeshStandardMaterial({
    color: new THREE.Color(secondaryHex),
    roughness: 0.5,
    metalness: 0.2,
  });
  matSecondary.name = 'mat_secondary';

  const matWood = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0x5c4033),
    roughness: 0.7,
  });

  const matChrome = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xd1d5db),
    metalness: 0.8,
    roughness: 0.2,
  });

  const matGlass = new THREE.MeshStandardMaterial({
    color: new THREE.Color(0xa5f3fc),
    transparent: true,
    opacity: 0.45,
    roughness: 0.1,
  });

  // --- 1. BEDS ---
  if (itemType === 'bed') {
    let w = 1.5, l = 2.0, h_head = 1.0;
    if (variant === 'single') { w = 0.9; l = 1.9; h_head = 0.9; }
    else if (variant === 'king') { w = 1.8; l = 2.0; h_head = 1.1; }

    // Frame
    const frame = createBox(w, 0.25, l, matWood);
    frame.position.y = 0.125;
    group.add(frame);

    // Mattress
    const mattress = createBox(w * 0.95, 0.25, l * 0.95, matPrimary);
    mattress.position.y = 0.375;
    group.add(mattress);

    // Headboard
    const headboard = createBox(w, h_head, 0.08, matSecondary);
    headboard.position.set(0, h_head / 2, -l / 2 + 0.04);
    group.add(headboard);

    // Pillows
    const pW = w > 1.2 ? (w * 0.4) : (w * 0.7);
    const pCount = w > 1.2 ? 2 : 1;
    for (let i = 0; i < pCount; i++) {
      const pillow = createBox(pW, 0.1, 0.35, matPrimary);
      const posX = pCount === 2 ? (i === 0 ? -w * 0.23 : w * 0.23) : 0;
      pillow.position.set(posX, 0.55, -l / 2 + 0.3);
      group.add(pillow);
    }
  } else if (itemType === 'bunk_bed') {
    const w = 0.9, l = 1.9, totalH = 1.6;
    // 4 Corner Posts
    const postThick = 0.06;
    const postMat = matWood;
    const xs = [-w / 2 + postThick / 2, w / 2 - postThick / 2];
    const zs = [-l / 2 + postThick / 2, l / 2 - postThick / 2];
    xs.forEach((px) => {
      zs.forEach((pz) => {
        const post = createBox(postThick, totalH, postThick, postMat);
        post.position.set(px, totalH / 2, pz);
        group.add(post);
      });
    });

    // Lower bunk
    const m1 = createBox(w - 0.08, 0.2, l - 0.08, matPrimary);
    m1.position.y = 0.35;
    group.add(m1);

    // Upper bunk
    const m2 = createBox(w - 0.08, 0.2, l - 0.08, matSecondary);
    m2.position.y = 1.35;
    group.add(m2);

    // Ladder rungs
    for (let r = 0; r < 4; r++) {
      const rung = createBox(0.04, 0.03, 0.3, matWood);
      rung.position.set(w / 2 - 0.02, 0.4 + r * 0.25, 0);
      group.add(rung);
    }
  }

  // --- 2. SEATING ---
  else if (itemType === 'sofa') {
    if (variant === '2-seater' || variant === '3-seater') {
      const is3 = variant === '3-seater';
      const w = is3 ? 2.1 : 1.5;
      const d = 0.85, h = 0.8;

      // Base seat cushion
      const base = createBox(w, 0.38, d, matPrimary);
      base.position.y = 0.19;
      group.add(base);

      // Backrest
      const back = createBox(w, 0.42, 0.2, matPrimary);
      back.position.set(0, 0.59, -d / 2 + 0.1);
      group.add(back);

      // Back cushions
      const cCount = is3 ? 3 : 2;
      const cWidth = (w - 0.3) / cCount;
      for (let i = 0; i < cCount; i++) {
        const cX = -(w - 0.3) / 2 + cWidth / 2 + i * cWidth;
        const c = createBox(cWidth * 0.95, 0.35, 0.12, matSecondary);
        c.position.set(cX, 0.58, -d / 2 + 0.22);
        group.add(c);
      }

      // Armrests
      const armL = createBox(0.15, 0.3, d, matPrimary);
      armL.position.set(-w / 2 + 0.075, 0.45, 0);
      group.add(armL);

      const armR = createBox(0.15, 0.3, d, matPrimary);
      armR.position.set(w / 2 - 0.075, 0.45, 0);
      group.add(armR);

      // 4 Metal Legs
      [[-w / 2 + 0.1, -d / 2 + 0.1], [w / 2 - 0.1, -d / 2 + 0.1], [-w / 2 + 0.1, d / 2 - 0.1], [w / 2 - 0.1, d / 2 - 0.1]].forEach(([lx, lz]) => {
        const leg = createCylinder(0.025, 0.015, 0.08, 12, matChrome);
        leg.position.set(lx, 0.04, lz);
        group.add(leg);
      });
    } else if (variant === 'l-shaped') {
      const w = 2.4, d = 0.85, chaiseL = 1.8;
      // Main section
      const main = createBox(w, 0.4, d, matPrimary);
      main.position.set(0, 0.2, 0);
      group.add(main);

      // Chaise lounge section
      const chaise = createBox(0.9, 0.4, chaiseL - d, matPrimary);
      chaise.position.set(w / 2 - 0.45, 0.2, (chaiseL - d) / 2 + d / 2);
      group.add(chaise);

      // Backrest along width
      const back = createBox(w, 0.45, 0.18, matSecondary);
      back.position.set(0, 0.625, -d / 2 + 0.09);
      group.add(back);

      // Left Armrest
      const armL = createBox(0.18, 0.32, d, matSecondary);
      armL.position.set(-w / 2 + 0.09, 0.48, 0);
      group.add(armL);
    }
  } else if (itemType === 'armchair') {
    const w = 0.85, d = 0.85;
    const seat = createBox(w * 0.7, 0.35, d * 0.7, matPrimary);
    seat.position.y = 0.25;
    group.add(seat);

    const back = createBox(w * 0.7, 0.45, 0.15, matPrimary);
    back.position.set(0, 0.6, -d * 0.35 + 0.075);
    group.add(back);

    const armL = createBox(0.12, 0.28, d * 0.7, matSecondary);
    armL.position.set(-w * 0.35 + 0.06, 0.42, 0);
    group.add(armL);

    const armR = createBox(0.12, 0.28, d * 0.7, matSecondary);
    armR.position.set(w * 0.35 - 0.06, 0.42, 0);
    group.add(armR);

    // Legs
    [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].forEach(([lx, lz]) => {
      const leg = createCylinder(0.02, 0.015, 0.15, 12, matChrome);
      leg.position.set(lx, 0.075, lz);
      group.add(leg);
    });
  } else if (itemType === 'chair') {
    if (variant === 'dining_chair') {
      const seat = createBox(0.48, 0.05, 0.48, matPrimary);
      seat.position.y = 0.45;
      group.add(seat);

      const back = createBox(0.44, 0.45, 0.04, matSecondary);
      back.position.set(0, 0.7, -0.22);
      group.add(back);

      // 4 wooden legs
      [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]].forEach(([lx, lz]) => {
        const leg = createBox(0.04, 0.45, 0.04, matWood);
        leg.position.set(lx, 0.225, lz);
        group.add(leg);
      });
    } else {
      // Office chair
      const base = createCylinder(0.3, 0.3, 0.05, 16, matChrome);
      base.position.y = 0.08;
      group.add(base);

      const stem = createCylinder(0.03, 0.03, 0.35, 12, matChrome);
      stem.position.y = 0.25;
      group.add(stem);

      const seat = createBox(0.55, 0.08, 0.52, matPrimary);
      seat.position.y = 0.45;
      group.add(seat);

      const back = createBox(0.48, 0.5, 0.06, matSecondary);
      back.position.set(0, 0.72, -0.23);
      group.add(back);
    }
  } else if (itemType === 'stool') {
    const seat = createCylinder(0.18, 0.18, 0.05, 24, matPrimary);
    seat.position.y = 0.75;
    group.add(seat);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const leg = createCylinder(0.015, 0.015, 0.75, 12, matChrome);
      leg.position.set(Math.cos(angle) * 0.14, 0.375, Math.sin(angle) * 0.14);
      group.add(leg);
    }
  }

  // --- 3. STORAGE ---
  else if (itemType === 'wardrobe') {
    let w = 1.0;
    if (variant === '3-door') w = 1.5;
    else if (variant === 'sliding') w = 1.8;
    const h = 2.1, d = 0.6;

    const carcass = createBox(w, h, d, matPrimary);
    carcass.position.set(0, h / 2, 0);
    group.add(carcass);

    // Front door panels
    const doorCount = variant === '3-door' ? 3 : 2;
    const doorW = (w - 0.04) / doorCount;
    for (let i = 0; i < doorCount; i++) {
      const dX = -(w - 0.04) / 2 + doorW / 2 + i * doorW;
      const panel = createBox(doorW * 0.96, h * 0.94, 0.02, matSecondary);
      panel.position.set(dX, h / 2, d / 2 + 0.01);
      group.add(panel);

      // Handle
      const handle = createBox(0.02, 0.18, 0.02, matChrome);
      handle.position.set(dX + (doorW * 0.38), h / 2, d / 2 + 0.03);
      group.add(handle);
    }
  } else if (itemType === 'chest_drawers') {
    const w = 0.9, h = 1.0, d = 0.5;
    const body = createBox(w, h, d, matPrimary);
    body.position.set(0, h / 2, 0);
    group.add(body);

    for (let i = 0; i < 4; i++) {
      const drawerY = 0.15 + i * 0.22;
      const face = createBox(w * 0.92, 0.18, 0.02, matSecondary);
      face.position.set(0, drawerY, d / 2 + 0.01);
      group.add(face);

      const pull = createBox(0.12, 0.02, 0.02, matChrome);
      pull.position.set(0, drawerY, d / 2 + 0.03);
      group.add(pull);
    }
  } else if (itemType === 'bookshelf') {
    const w = 0.8, h = 1.8, d = 0.35;
    // Outer frame
    const outer = createBox(w, h, d, matPrimary);
    outer.position.set(0, h / 2, 0);
    group.add(outer);

    // 5 Shelves
    for (let i = 1; i <= 4; i++) {
      const shelf = createBox(w * 0.94, 0.03, d * 0.95, matSecondary);
      shelf.position.set(0, (h / 5) * i, 0.01);
      group.add(shelf);
    }
  } else if (itemType === 'shoe_rack') {
    const w = 0.8, h = 0.7, d = 0.3;
    const frame = createBox(w, h, d, matPrimary);
    frame.position.set(0, h / 2, 0);
    group.add(frame);

    for (let i = 1; i <= 3; i++) {
      const tier = createBox(w * 0.92, 0.02, d * 0.9, matSecondary);
      tier.position.set(0, 0.15 + (i - 1) * 0.2, 0.02);
      group.add(tier);
    }
  } else if (itemType === 'kitchen_cabinet') {
    if (variant === 'wall_unit') {
      const w = 0.9, h = 0.7, d = 0.35;
      const cabinet = createBox(w, h, d, matPrimary);
      cabinet.position.set(0, h / 2, 0);
      group.add(cabinet);

      const d1 = createBox(w * 0.46, h * 0.9, 0.02, matSecondary);
      d1.position.set(-w * 0.24, h / 2, d / 2 + 0.01);
      group.add(d1);

      const d2 = createBox(w * 0.46, h * 0.9, 0.02, matSecondary);
      d2.position.set(w * 0.24, h / 2, d / 2 + 0.01);
      group.add(d2);
    } else {
      // Base unit with countertop
      const w = 0.9, h = 0.85, d = 0.6;
      const base = createBox(w, h - 0.05, d, matPrimary);
      base.position.set(0, (h - 0.05) / 2, 0);
      group.add(base);

      const counter = createBox(w + 0.04, 0.05, d + 0.04, matSecondary);
      counter.position.set(0, h - 0.025, 0.02);
      group.add(counter);
    }
  }

  // --- 4. TABLES ---
  else if (itemType === 'dining_table') {
    const is6 = variant === '6-seat';
    const w = is6 ? 1.8 : 1.2, d = is6 ? 0.9 : 0.8, h = 0.75;

    const top = createBox(w, 0.05, d, matPrimary);
    top.position.set(0, h - 0.025, 0);
    group.add(top);

    [[-w / 2 + 0.08, -d / 2 + 0.08], [w / 2 - 0.08, -d / 2 + 0.08], [-w / 2 + 0.08, d / 2 - 0.08], [w / 2 - 0.08, d / 2 - 0.08]].forEach(([lx, lz]) => {
      const leg = createBox(0.06, h - 0.05, 0.06, matSecondary);
      leg.position.set(lx, (h - 0.05) / 2, lz);
      group.add(leg);
    });
  } else if (itemType === 'coffee_table') {
    if (variant === 'round') {
      const top = createCylinder(0.4, 0.4, 0.04, 32, matPrimary);
      top.position.set(0, 0.43, 0);
      group.add(top);

      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const leg = createCylinder(0.02, 0.015, 0.41, 12, matSecondary);
        leg.position.set(Math.cos(angle) * 0.28, 0.205, Math.sin(angle) * 0.28);
        group.add(leg);
      }
    } else {
      const w = 1.1, d = 0.6, h = 0.45;
      const top = createBox(w, 0.04, d, matPrimary);
      top.position.set(0, h - 0.02, 0);
      group.add(top);

      const shelf = createBox(w * 0.85, 0.02, d * 0.85, matSecondary);
      shelf.position.set(0, 0.18, 0);
      group.add(shelf);

      [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]].forEach(([lx, lz]) => {
        const leg = createBox(0.04, h - 0.04, 0.04, matSecondary);
        leg.position.set(lx, (h - 0.04) / 2, lz);
        group.add(leg);
      });
    }
  } else if (itemType === 'desk') {
    const w = 1.2, d = 0.6, h = 0.75;
    const top = createBox(w, 0.05, d, matPrimary);
    top.position.set(0, h - 0.025, 0);
    group.add(top);

    // Left leg panel
    const legL = createBox(0.05, h - 0.05, d, matSecondary);
    legL.position.set(-w / 2 + 0.025, (h - 0.05) / 2, 0);
    group.add(legL);

    // Right drawers stack
    const drawers = createBox(0.35, h - 0.05, d * 0.9, matSecondary);
    drawers.position.set(w / 2 - 0.175, (h - 0.05) / 2, 0);
    group.add(drawers);
  } else if (itemType === 'side_table') {
    const w = 0.45, d = 0.4, h = 0.5;
    const body = createBox(w, h, d, matPrimary);
    body.position.set(0, h / 2, 0);
    group.add(body);

    const drawer = createBox(w * 0.88, 0.14, 0.02, matSecondary);
    drawer.position.set(0, h * 0.65, d / 2 + 0.01);
    group.add(drawer);
  } else if (itemType === 'dressing_table') {
    const w = 1.0, d = 0.45, hDesk = 0.75, hMirror = 0.65;
    const desk = createBox(w, hDesk, d, matPrimary);
    desk.position.set(0, hDesk / 2, 0);
    group.add(desk);

    // Mirror on top
    const mirrorFrame = createBox(0.7, hMirror, 0.04, matSecondary);
    mirrorFrame.position.set(0, hDesk + hMirror / 2, -d / 2 + 0.05);
    group.add(mirrorFrame);

    const mirrorGlass = createBox(0.6, hMirror - 0.1, 0.01, matGlass);
    mirrorGlass.position.set(0, hDesk + hMirror / 2, -d / 2 + 0.08);
    group.add(mirrorGlass);
  }

  // --- 5. ELECTRONICS & APPLIANCES ---
  else if (itemType === 'tv') {
    const w = 1.2, h = 0.7, d = 0.08;
    const screen = createBox(w, h, d, matSecondary);
    screen.position.set(0, h / 2, 0);
    group.add(screen);

    const display = createBox(w * 0.96, h * 0.94, 0.01, new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 }));
    display.position.set(0, h / 2, d / 2 + 0.005);
    group.add(display);

    if (variant === 'on_stand') {
      const stand = createBox(0.4, 0.02, 0.25, matChrome);
      stand.position.set(0, 0.01, 0);
      group.add(stand);

      const stem = createBox(0.08, 0.15, 0.05, matChrome);
      stem.position.set(0, 0.08, 0);
      group.add(stem);
      screen.position.y += 0.15;
      display.position.y += 0.15;
    }
  } else if (itemType === 'tv_unit') {
    const w = 1.6, h = 0.5, d = 0.45;
    const consoleUnit = createBox(w, h, d, matPrimary);
    consoleUnit.position.set(0, h / 2, 0);
    group.add(consoleUnit);

    const shelf = createBox(w * 0.9, 0.03, d * 0.85, matSecondary);
    shelf.position.set(0, h / 2, 0.02);
    group.add(shelf);
  } else if (itemType === 'refrigerator') {
    const isDouble = variant === 'double_door';
    const w = isDouble ? 0.8 : 0.6, h = isDouble ? 1.8 : 1.6, d = 0.75;

    const fridge = createBox(w, h, d, matPrimary);
    fridge.position.set(0, h / 2, 0);
    group.add(fridge);

    if (isDouble) {
      // Split upper & lower doors
      const split = createBox(w, 0.02, 0.02, matSecondary);
      split.position.set(0, h * 0.65, d / 2 + 0.01);
      group.add(split);
    }

    const handle = createBox(0.03, 0.4, 0.03, matChrome);
    handle.position.set(w / 2 - 0.06, h * 0.5, d / 2 + 0.03);
    group.add(handle);
  } else if (itemType === 'washing_machine') {
    const w = 0.6, h = 0.85, d = 0.6;
    const washer = createBox(w, h, d, matPrimary);
    washer.position.set(0, h / 2, 0);
    group.add(washer);

    // Front loading circular glass door
    const door = createCylinder(0.18, 0.18, 0.04, 24, matChrome);
    door.rotation.x = Math.PI / 2;
    door.position.set(0, h * 0.45, d / 2 + 0.02);
    group.add(door);

    const glass = createCylinder(0.14, 0.14, 0.02, 24, matGlass);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, h * 0.45, d / 2 + 0.03);
    group.add(glass);
  } else if (itemType === 'air_conditioner') {
    const w = 0.9, h = 0.3, d = 0.25;
    const ac = createBox(w, h, d, matPrimary);
    ac.position.set(0, h / 2, 0);
    group.add(ac);

    const louver = createBox(w * 0.85, 0.04, 0.02, matSecondary);
    louver.position.set(0, 0.05, d / 2 + 0.01);
    group.add(louver);
  }

  // --- 6. BATHROOM ---
  else if (itemType === 'toilet') {
    const w = 0.4, h = 0.75, d = 0.65;
    // Tank
    const tank = createBox(w, 0.45, 0.25, matPrimary);
    tank.position.set(0, 0.525, -d / 2 + 0.125);
    group.add(tank);

    // Bowl
    const bowl = createCylinder(0.18, 0.14, 0.38, 20, matPrimary);
    bowl.position.set(0, 0.19, 0.08);
    group.add(bowl);

    // Seat lid
    const lid = createBox(0.38, 0.04, 0.42, matSecondary);
    lid.position.set(0, 0.4, 0.08);
    group.add(lid);
  } else if (itemType === 'wash_basin') {
    const w = 0.6, h = 0.85, d = 0.5;
    const vanity = createBox(w, h - 0.15, d, matSecondary);
    vanity.position.set(0, (h - 0.15) / 2, 0);
    group.add(vanity);

    const basin = createBox(w + 0.02, 0.15, d + 0.02, matPrimary);
    basin.position.set(0, h - 0.075, 0);
    group.add(basin);

    const faucet = createCylinder(0.015, 0.015, 0.12, 12, matChrome);
    faucet.position.set(0, h + 0.06, -d / 2 + 0.08);
    group.add(faucet);
  } else if (itemType === 'shower') {
    const w = 0.9, h = 2.1, d = 0.9;
    const tray = createBox(w, 0.08, d, matPrimary);
    tray.position.set(0, 0.04, 0);
    group.add(tray);

    const glassL = createBox(0.02, h, d, matGlass);
    glassL.position.set(-w / 2 + 0.01, h / 2, 0);
    group.add(glassL);

    const glassF = createBox(w, h, 0.02, matGlass);
    glassF.position.set(0, h / 2, d / 2 - 0.01);
    group.add(glassF);

    const head = createCylinder(0.08, 0.08, 0.02, 16, matChrome);
    head.position.set(0, h - 0.15, 0);
    group.add(head);
  } else if (itemType === 'bathtub') {
    const w = 1.7, h = 0.6, d = 0.75;
    const tub = createBox(w, h, d, matPrimary);
    tub.position.set(0, h / 2, 0);
    group.add(tub);

    const rim = createBox(w + 0.06, 0.04, d + 0.06, matSecondary);
    rim.position.set(0, h - 0.02, 0);
    group.add(rim);
  }

  // --- 7. DECOR & EXTRAS ---
  else if (itemType === 'rug') {
    if (variant === 'round') {
      const rug = createCylinder(0.8, 0.8, 0.015, 32, matPrimary);
      rug.position.set(0, 0.008, 0);
      group.add(rug);
    } else {
      const rug = createBox(2.0, 0.015, 1.5, matPrimary);
      rug.position.set(0, 0.008, 0);
      group.add(rug);
    }
  } else if (itemType === 'potted_plant') {
    const isFloor = variant === 'floor_plant';
    const potR = isFloor ? 0.18 : 0.1;
    const potH = isFloor ? 0.35 : 0.18;

    const pot = createCylinder(potR, potR * 0.75, potH, 16, matSecondary);
    pot.position.set(0, potH / 2, 0);
    group.add(pot);

    // Stem
    const stem = createCylinder(0.015, 0.015, potH * 1.5, 8, matWood);
    stem.position.set(0, potH + (potH * 1.5) / 2, 0);
    group.add(stem);

    // Leaves / foliage
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 });
    const leafCount = isFloor ? 5 : 3;
    for (let i = 0; i < leafCount; i++) {
      const leaf = createBox(0.2, 0.01, 0.2, foliageMat);
      const angle = (i * Math.PI * 2) / leafCount;
      leaf.position.set(Math.cos(angle) * 0.15, potH + 0.2 + i * 0.1, Math.sin(angle) * 0.15);
      leaf.rotation.y = angle;
      leaf.rotation.z = 0.2;
      group.add(leaf);
    }
  } else if (itemType === 'ceiling_fan') {
    // Mounting canopy & downrod
    const canopy = createCylinder(0.09, 0.09, 0.06, 16, matSecondary);
    canopy.position.set(0, 0.42, 0);
    group.add(canopy);

    const downrod = createCylinder(0.012, 0.012, 0.22, 12, matChrome);
    downrod.position.set(0, 0.29, 0);
    group.add(downrod);

    // Motor Hub (stationary housing)
    const motor = createCylinder(0.14, 0.14, 0.1, 24, matSecondary);
    motor.position.set(0, 0.19, 0);
    group.add(motor);

    // Rotating Rotor & Aerodynamic Blades Group
    const rotor = new THREE.Group();
    rotor.position.set(0, 0.17, 0);
    rotor.userData.isFanBlades = true; // Tagged for 3D spin animation!

    const bladeCount = variant === 'metal_fan' ? 4 : 3;
    const bladeLen = 0.52;
    const bladeW = variant === 'metal_fan' ? 0.11 : 0.14;
    const bladeMat = variant === 'metal_fan' ? matChrome : matPrimary;

    for (let i = 0; i < bladeCount; i++) {
      const angle = (i * Math.PI * 2) / bladeCount;
      const bladeHolder = new THREE.Group();
      bladeHolder.rotation.y = angle;

      const blade = createBox(bladeLen, 0.012, bladeW, bladeMat);
      blade.position.set(bladeLen / 2 + 0.07, 0, 0);
      blade.rotation.x = 0.15; // aerodynamic pitch
      bladeHolder.add(blade);
      rotor.add(bladeHolder);
    }
    group.add(rotor);

    // Optional Center LED Light
    if (variant === 'light_fan') {
      const lightBowlMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 0.9,
        roughness: 0.1,
      });
      lightBowlMat.name = 'mat_light_bulb';
      const bowl = createCylinder(0.11, 0.08, 0.06, 24, lightBowlMat);
      bowl.position.set(0, 0.11, 0);
      group.add(bowl);

      // Real 3D PointLight casting soft illuminated glow onto room
      const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 1.6, 6.0, 1.2);
      pointLight.position.set(0, 0.06, 0);
      pointLight.name = 'fixture_light';
      group.add(pointLight);
    }
  } else if (itemType === 'ceiling_lamp') {
    if (variant === 'chandelier') {
      // Modern Ring Chandelier
      const ringMat = matSecondary;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.02, 12, 32), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.15, 0);
      group.add(ring);

      // Suspension Cords
      for (let i = 0; i < 3; i++) {
        const ang = (i * Math.PI * 2) / 3;
        const cord = createCylinder(0.004, 0.004, 0.45, 8, matChrome);
        cord.position.set(Math.cos(ang) * 0.18, 0.38, Math.sin(ang) * 0.18);
        group.add(cord);
      }

      // 6 Glowing Lights on the Ring
      const bulbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 0.95,
      });
      bulbMat.name = 'mat_light_bulb';

      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI * 2) / 6;
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), bulbMat);
        bulb.position.set(Math.cos(ang) * 0.35, 0.16, Math.sin(ang) * 0.35);
        group.add(bulb);
      }

      const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 2.2, 8.0, 1.2);
      pointLight.position.set(0, 0.1, 0);
      pointLight.name = 'fixture_light';
      group.add(pointLight);
    } else if (variant === 'spotlight') {
      // Recessed Ceiling Downlight
      const bezel = createCylinder(0.12, 0.12, 0.02, 20, matSecondary);
      bezel.position.set(0, 0.01, 0);
      group.add(bezel);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 1.0,
      });
      bulbMat.name = 'mat_light_bulb';
      const bulb = createCylinder(0.09, 0.09, 0.015, 20, bulbMat);
      bulb.position.set(0, 0.005, 0);
      group.add(bulb);

      const spot = new THREE.PointLight(new THREE.Color(primaryHex), 1.8, 5.0, 1.2);
      spot.position.set(0, -0.05, 0);
      spot.name = 'fixture_light';
      group.add(spot);
    } else {
      // Warm Pendant Lamp
      const cord = createCylinder(0.006, 0.006, 0.5, 8, matSecondary);
      cord.position.set(0, 0.45, 0);
      group.add(cord);

      const shade = createCylinder(0.22, 0.08, 0.22, 24, matSecondary);
      shade.position.set(0, 0.16, 0);
      group.add(shade);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 0.95,
      });
      bulbMat.name = 'mat_light_bulb';
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), bulbMat);
      bulb.position.set(0, 0.1, 0);
      group.add(bulb);

      const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 1.8, 6.0, 1.2);
      pointLight.position.set(0, 0.08, 0);
      pointLight.name = 'fixture_light';
      group.add(pointLight);
    }
  } else if (itemType === 'floor_lamp') {
    const base = createCylinder(0.18, 0.18, 0.03, 20, matSecondary);
    base.position.set(0, 0.015, 0);
    group.add(base);

    if (variant === 'corner_ambient') {
      // Vertical Minimalist Mood Light Bar
      const barMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 0.9,
      });
      barMat.name = 'mat_light_bulb';
      const lightBar = createCylinder(0.02, 0.02, 1.35, 12, barMat);
      lightBar.position.set(0, 0.7, 0);
      group.add(lightBar);

      const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 1.6, 5.0, 1.2);
      pointLight.position.set(0, 0.8, 0.05);
      pointLight.name = 'fixture_light';
      group.add(pointLight);
    } else {
      // Standing Arc Floor Lamp
      const pole = createCylinder(0.015, 0.015, 1.45, 12, matChrome);
      pole.position.set(0, 0.75, 0);
      group.add(pole);

      const shade = createCylinder(0.22, 0.28, 0.35, 24, matSecondary);
      shade.position.set(0, 1.45, 0);
      group.add(shade);

      const bulbMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(primaryHex),
        emissive: new THREE.Color(primaryHex),
        emissiveIntensity: 0.95,
      });
      bulbMat.name = 'mat_light_bulb';
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), bulbMat);
      bulb.position.set(0, 1.4, 0);
      group.add(bulb);

      const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 1.6, 5.5, 1.2);
      pointLight.position.set(0, 1.35, 0);
      pointLight.name = 'fixture_light';
      group.add(pointLight);
    }
  } else if (itemType === 'table_lamp') {
    // Bedside Lamp
    const base = createCylinder(0.08, 0.1, 0.025, 16, matSecondary);
    base.position.set(0, 0.0125, 0);
    group.add(base);

    const stem = createCylinder(0.01, 0.01, 0.25, 12, matChrome);
    stem.position.set(0, 0.15, 0);
    group.add(stem);

    const shade = createCylinder(0.12, 0.15, 0.18, 20, matSecondary);
    shade.position.set(0, 0.32, 0);
    group.add(shade);

    const bulbMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(primaryHex),
      emissive: new THREE.Color(primaryHex),
      emissiveIntensity: 0.9,
    });
    bulbMat.name = 'mat_light_bulb';
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 12), bulbMat);
    bulb.position.set(0, 0.28, 0);
    group.add(bulb);

    const pointLight = new THREE.PointLight(new THREE.Color(primaryHex), 1.2, 3.5, 1.2);
    pointLight.position.set(0, 0.28, 0);
    pointLight.name = 'fixture_light';
    group.add(pointLight);
  } else if (itemType === 'curtains') {
    const w = 1.4, h = 2.2;
    const rod = createCylinder(0.015, 0.015, w + 0.2, 12, matChrome);
    rod.rotation.z = Math.PI / 2;
    rod.position.set(0, h, 0);
    group.add(rod);

    const drapeL = createBox(0.35, h - 0.1, 0.05, matPrimary);
    drapeL.position.set(-w / 2 + 0.2, (h - 0.1) / 2, 0);
    group.add(drapeL);

    const drapeR = createBox(0.35, h - 0.1, 0.05, matPrimary);
    drapeR.position.set(w / 2 - 0.2, (h - 0.1) / 2, 0);
    group.add(drapeR);
  } else if (itemType === 'mirror') {
    const w = 0.6, h = 0.9;
    const frame = createBox(w, h, 0.04, matSecondary);
    frame.position.set(0, h / 2, 0);
    group.add(frame);

    const glass = createBox(w - 0.08, h - 0.08, 0.01, matGlass);
    glass.position.set(0, h / 2, 0.025);
    group.add(glass);
  } else if (itemType === 'wall_frame') {
    const w = 0.7, h = 0.5;
    const frame = createBox(w, h, 0.04, matSecondary);
    frame.position.set(0, h / 2, 0);
    group.add(frame);

    const art = createBox(w - 0.08, h - 0.08, 0.01, matPrimary);
    art.position.set(0, h / 2, 0.025);
    group.add(art);
  } else {
    // Fallback default box
    const fallback = createBox(0.8, 0.8, 0.8, matPrimary);
    fallback.position.set(0, 0.4, 0);
    group.add(fallback);
  }

  return group;
}

/**
 * Updates primary and/or secondary colors of an existing furniture model group.
 * Dynamically recolors light bulbs and real PointLights.
 */
export function updateFurnitureColors(group, primaryHex, secondaryHex) {
  if (!group) return;
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      if (primaryHex && child.material.name === 'mat_primary') {
        child.material.color.set(primaryHex);
      }
      if (secondaryHex && child.material.name === 'mat_secondary') {
        child.material.color.set(secondaryHex);
      }
      if (primaryHex && child.material.name === 'mat_light_bulb') {
        child.material.color.set(primaryHex);
        if (child.material.emissive) child.material.emissive.set(primaryHex);
      }
    }
    // Update PointLight color if attached to fixture
    if (child.isPointLight && child.name === 'fixture_light' && primaryHex) {
      child.color.set(primaryHex);
    }
  });
}
