import { vec3, vec4, mat4 } from 'gl-matrix'
import { T3, T4 } from './types'

interface CameraOpts {
  pos?: vec3
  up?: vec3
  target?: vec3
}

export default class Camera {
  private _viewMat: mat4
  private _viewOpts: CameraOpts = {
    pos: vec3.fromValues(0, 0, 1),
    up: vec3.fromValues(0, 1, 0),
    target: vec3.fromValues(0, 0, 0),
  }

  private _mouseX = 0
  private _mouseY = 0
  private _dMouseX = 0
  private _dMouseY = 0
  private _lastMouseX = 0
  private _lastMouseY = 0
  private _mousedown = false

  constructor(opts?: CameraOpts) {
    if (opts) {
      Object.assign(this._viewOpts, opts)
    }

    this._viewMat = mat4.create()

    mat4.lookAt(this._viewMat, this._viewOpts.pos, this._viewOpts.target, this._viewOpts.up)
  }

  initArcball(canvas: HTMLCanvasElement) {
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect()
      this._mouseX = e.clientX - rect.left
      this._mouseY = e.clientY - rect.top

      this._dMouseX = this._lastMouseX - this._mouseX
      this._dMouseY = this._lastMouseY - this._mouseY

      this._lastMouseX = this._mouseX
      this._lastMouseY = this._mouseY
    })

    canvas.addEventListener('mousedown', () => (this._mousedown = true))
    canvas.addEventListener('mouseup', () => (this._mousedown = false))
    canvas.addEventListener('mouseout', () => (this._mousedown = false))
  }

  arcball() {
    if (!this._mousedown) return
    const pos = vec4.fromValues(...(this._viewOpts.pos as T3), 1) as T4
    const pivot = vec4.fromValues(...(this._viewOpts.target as T3), 1) as T4

    const dThetaX = (2 * Math.PI) / window.innerWidth
    let dThetaY = Math.PI / window.innerHeight

    const thetaX = this._dMouseX * dThetaX * 0.5
    const thetaY = this._dMouseY * dThetaY * 0.5

    const appUp = vec3.fromValues(0, 1, 0)

    const cosTheta = vec3.dot(this.viewDir, appUp)
    if (cosTheta * Math.sign(dThetaY) > 0.99) dThetaY = 0

    const rotMatX = mat4.fromRotation(mat4.create(), thetaX, appUp)
    vec4.sub(pos, pos, pivot)
    vec4.transformMat4(pos, pos, rotMatX)
    vec4.add(pos, pos, pivot)

    const rotMatY = mat4.fromRotation(mat4.create(), thetaY, this.right)
    vec4.sub(pos, pos, pivot)
    vec4.transformMat4(pos, pos, rotMatY)
    vec4.add(pos, pos, pivot)

    this.view = {
      pos: vec3.fromValues(...(pos.slice(0, 3) as T3)),
    }

    this._lastMouseX = this._mouseX
    this._lastMouseY = this._mouseY
  }

  set view(opts: CameraOpts) {
    Object.assign(this._viewOpts, opts)
    mat4.lookAt(this._viewMat, this._viewOpts.pos, this._viewOpts.target, this._viewOpts.up)
  }

  get viewMat(): mat4 {
    return this._viewMat
  }

  get pos(): vec3 {
    return this._viewOpts.pos
  }

  get up(): vec3 {
    return this._viewOpts.up
  }

  get target(): vec3 {
    return this._viewOpts.target
  }

  get viewDir(): vec3 {
    const transpose = mat4.transpose(mat4.create(), this._viewMat)
    const slice = transpose.slice(8, 11) as T3
    const viewDir = vec3.fromValues(...slice)

    return vec3.negate(vec3.create(), viewDir)
  }

  get right(): vec3 {
    const transpose = mat4.transpose(mat4.create(), this._viewMat)
    const slice = transpose.slice(0, 3) as T3
    return vec3.fromValues(...slice)
  }
}
