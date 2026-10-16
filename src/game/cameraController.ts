import * as THREE from 'three';
import { CameraMode } from './types';

export class FlightCameraController {
  public camera: THREE.PerspectiveCamera;
  public mode: CameraMode = 'chase';

  private targetCamPos: THREE.Vector3 = new THREE.Vector3();
  private currentCamPos: THREE.Vector3 = new THREE.Vector3();
  private targetLookAt: THREE.Vector3 = new THREE.Vector3();
  private currentLookAt: THREE.Vector3 = new THREE.Vector3();

  // Cinematic orbit angle for title screen
  private orbitAngle: number = 0;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.5, 35000);
    this.currentCamPos.set(0, 480, -450);
    this.camera.position.copy(this.currentCamPos);
  }

  public updateChase(
    jetPos: THREE.Vector3,
    jetForward: THREE.Vector3,
    jetUp: THREE.Vector3,
    isBoosting: boolean,
    cameraShake: number,
    delta: number
  ) {
    // Chase distance increases when boosting for FOV / speed sensation
    const followDist = isBoosting ? 26 : 21;
    const followHeight = 4.8;

    // Ideal camera position behind and above the jet
    this.targetCamPos.copy(jetPos)
      .addScaledVector(jetForward, -followDist)
      .addScaledVector(jetUp, followHeight);

    // Look point ahead of jet
    this.targetLookAt.copy(jetPos).addScaledVector(jetForward, 60);

    // Smooth exponential damping
    const smoothFactor = 12.0;
    this.currentCamPos.lerp(this.targetCamPos, THREE.MathUtils.clamp(smoothFactor * delta, 0, 1));
    this.currentLookAt.lerp(this.targetLookAt, THREE.MathUtils.clamp(smoothFactor * delta, 0, 1));

    // Dynamic FOV adjustment during boost
    const targetFov = isBoosting ? 74 : 64;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6.0, delta);
    this.camera.updateProjectionMatrix();

    // Apply position
    this.camera.position.copy(this.currentCamPos);

    // Apply camera shake
    if (cameraShake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * cameraShake * 1.5;
      this.camera.position.y += (Math.random() - 0.5) * cameraShake * 1.5;
      this.camera.position.z += (Math.random() - 0.5) * cameraShake * 1.5;
    }

    this.camera.lookAt(this.currentLookAt);

    // Roll alignment with aircraft up vector
    this.camera.up.lerp(jetUp, THREE.MathUtils.clamp(8.0 * delta, 0, 1));
  }

  public updateCockpit(
    cockpitAnchorPos: THREE.Vector3,
    jetForward: THREE.Vector3,
    jetUp: THREE.Vector3,
    cameraShake: number,
    delta: number
  ) {
    this.camera.position.copy(cockpitAnchorPos);

    // Subtle head vibration on shake
    if (cameraShake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * cameraShake * 0.4;
      this.camera.position.y += (Math.random() - 0.5) * cameraShake * 0.4;
    }

    const lookAt = cockpitAnchorPos.clone().addScaledVector(jetForward, 80);
    this.camera.lookAt(lookAt);
    this.camera.up.copy(jetUp);

    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 78, 6.0, delta);
    this.camera.updateProjectionMatrix();
  }

  public updateCinematicMenu(jetPos: THREE.Vector3, delta: number) {
    this.orbitAngle += 0.35 * delta;
    const radius = 24;
    const height = 4.5 + Math.sin(this.orbitAngle * 0.5) * 2;

    this.camera.position.set(
      jetPos.x + Math.sin(this.orbitAngle) * radius,
      jetPos.y + height,
      jetPos.z + Math.cos(this.orbitAngle) * radius
    );

    this.camera.lookAt(jetPos);
    this.camera.up.set(0, 1, 0);

    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 58, 4.0, delta);
    this.camera.updateProjectionMatrix();
  }

  public updateKillCam(
    targetPos: THREE.Vector3,
    playerPos: THREE.Vector3,
    progress: number, // 0 to 1
    delta: number
  ) {
    // Dynamic cinematic angle orbiting around the destroyed target
    const angle = progress * Math.PI * 0.4 + 0.8;
    const distance = THREE.MathUtils.lerp(30, 48, progress);
    const height = THREE.MathUtils.lerp(7, 16, progress);

    // Compute ideal kill cam position tracking target
    const idealPos = new THREE.Vector3(
      targetPos.x + Math.sin(angle) * distance,
      targetPos.y + height,
      targetPos.z + Math.cos(angle) * distance
    );

    // If near end of kill cam (progress > 0.72), smoothly blend back towards player position
    if (progress > 0.72) {
      const returnBlend = (progress - 0.72) / 0.28;
      const smoothReturn = returnBlend * returnBlend;
      idealPos.lerp(playerPos.clone().add(new THREE.Vector3(0, 4.8, -21)), smoothReturn);
    }

    this.currentCamPos.lerp(idealPos, THREE.MathUtils.clamp(12.0 * delta, 0, 1));
    this.camera.position.copy(this.currentCamPos);

    // Look at target explosion, blending back to player ahead at the end
    const lookTarget = targetPos.clone();
    if (progress > 0.72) {
      const returnBlend = (progress - 0.72) / 0.28;
      lookTarget.lerp(playerPos.clone().add(new THREE.Vector3(0, 0, 50)), returnBlend);
    }

    this.currentLookAt.lerp(lookTarget, THREE.MathUtils.clamp(12.0 * delta, 0, 1));
    this.camera.lookAt(this.currentLookAt);

    this.camera.up.set(0, 1, 0);

    // Dynamic cinematic focal length
    const cinematicFov = THREE.MathUtils.lerp(56, 46, progress);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, cinematicFov, 6.0, delta);
    this.camera.updateProjectionMatrix();
  }

  public setMode(mode: CameraMode) {
    this.mode = mode;
  }

  public toggleMode(): CameraMode {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
    return this.mode;
  }
}
