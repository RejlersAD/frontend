// Scene3DFocus.jsx — finding close-up (spec §3): a second PidScene3D on
// the same scene, aspect 16:9, zoomed to the finding's anchor with the
// line labels off so only the finding's area shows.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import PidScene3D from './pid-scene3d.js';
import './pid-scene3d.css';

export default function Scene3DFocus({ scene, findingId, anchor }) {
  const host = useRef(null);

  useEffect(() => {
    if (!scene || !host.current) return undefined;
    const v = new PidScene3D(host.current, scene, { THREE, OrbitControls });
    v.selectFinding(findingId, true);
    if (anchor) v.focusOn(anchor, 10);
    v.setLayer('labels', false);
    return () => v.dispose();
  }, [scene, findingId, anchor]);

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#F4F7FB', overflow: 'hidden' }}>
      <div ref={host} className="p3d" />
    </div>
  );
}
