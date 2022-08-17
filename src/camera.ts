import { vec3, mat4 } from 'gl-matrix'
import { T3 } from './types'

interface CameraOpts {
  pos?: vec3
  up?: vec3
  target?: vec3
}

export default class Camera {
  private _viewMat = mat4.create()
  private _viewOpts: CameraOpts = {
    pos: vec3.fromValues(0, 0, 1),
    up: vec3.fromValues(0, 1, 0),
    target: vec3.fromValues(0, 0, 0),
  }

  constructor(opts?: CameraOpts) {
    if (opts) {
      Object.assign(this._viewOpts, opts)
    }

    mat4.lookAt(this._viewMat, this._viewOpts.pos, this._viewOpts.target, this._viewOpts.up)
  }

  set viewOpts(opts: CameraOpts) {
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
