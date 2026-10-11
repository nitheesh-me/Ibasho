// V-0 fixture: stands in for a file in packages/plan. The plan kernel is L1 and must not import
// three (ARCH 15.2), so dependency-cruiser must report rule `engine-no-react-three-dom` here.
import '../../../packages/scene/node_modules/three/build/three.module.js';
