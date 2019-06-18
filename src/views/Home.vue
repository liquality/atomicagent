<template>
  <div>
    <div class="row mb-5">
      <div class="col-md-6 mx-auto">
        <div class="card">
          <div class="card-header">Node's addresses</div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item font-weight-normal">BTC: {{addresses.btc}}</li>
            <li class="list-group-item font-weight-normal">ETH: 0x{{addresses.eth}}</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="row mb-5 text-center">
      <div class="col-md-6">
        <div class="card mb-4">
          <div class="card-body">
            <h5 class="card-title mb-4">Paste the counter party link</h5>
            <input class="form-control form-control-lg" v-model="link" :readonly="swapId" />
            <button class="btn btn-lg btn-primary mt-4" v-if="link" @click="swap" :disabled="swapId">
              <span v-if="!(swapId && status !== 'done')">Swap</span>
              <Pacman class="loader-white mr-3" v-else />
            </button>
          </div>
        </div>
        <div class="alert alert-success" v-if="status === 'reciprocated'">
          <h5 class="mb-0">Node has reciprocated the swap.</h5>
        </div>

        <div class="alert alert-success" v-if="status === 'done'">
          <h5 class="mb-0">Swap is now complete.</h5>
        </div>
      </div>
      <div class="col-md-6">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-4">Initiate the swap</h5>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label text-right">You have</label>
              <div class="col-sm-8">
                <select class="form-control" v-model="have">
                  <option :key="coin" :value="coin" v-for="coin in list">{{coin.toUpperCase()}}</option>
                </select>
              </div>
            </div>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label text-right">You want</label>
              <div class="col-sm-8">
                <select class="form-control" v-model="want">
                  <option :key="coin" :value="coin" v-for="coin in list">{{coin.toUpperCase()}}</option>
                </select>
              </div>
            </div>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label text-right">{{have.toUpperCase()}} address</label>
              <div class="col-sm-8">
                <input type="text" class="form-control" v-model="haveAddr">
              </div>
            </div>
            <div class="form-group row">
              <label class="col-sm-4 col-form-label text-right">{{want.toUpperCase()}} address</label>
              <div class="col-sm-8">
                <input type="text" class="form-control" v-model="wantAddr">
              </div>
            </div>
            <button class="btn btn-lg btn-primary" v-if="haveAddr && wantAddr" :disabled="initInProgress" @click="init">
              <span v-if="!initInProgress">Initiate</span>
              <Pacman class="loader-white mr-3" v-else />
            </button>
          </div>
        </div>
        <div class="alert alert-success mt-4 mb-0" v-if="initLink" style="word-break: break-all">
          <h5 class="mb-0">{{initLink}}</h5>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import Pacman from '@/components/Pacman.vue'

export default {
  name: 'home',
  components: {
    Pacman
  },
  data: function () {
    return {
      link: '',
      swapId: null,
      status: null,
      addresses: {},
      have: 'btc',
      want: 'eth',
      list: [ 'btc', 'eth' ],
      initLink: null,
      haveAddr: null,
      wantAddr: null,
      initInProgress: false
    }
  },
  mounted: async function () {
    const { data } = await this.$http.get('/api/addresses')

    this.addresses = data.data
  },
  methods: {
    init: async function () {
      this.initInProgress = true
      const { data } = await this.$http.post('/api/init', {
        ccy1: this.have,
        ccy1Addr: this.haveAddr,
        ccy2: this.want,
        ccy2Addr: this.wantAddr
      })

      this.initLink = data.data
      this.initInProgress = false
    },
    swap: async function () {
      const { data } = await this.$http.post('/api/swap', {
        link: this.link
      })

      const { id } = data.data

      this.swapId = id

      this.check()
    },
    check: async function () {
      const { data } = await this.$http.get('/api/check', {
        params: {
          id: this.swapId
        }
      })

      this.status = data.status

      if ([ 'pending', 'reciprocated' ].includes(data.status)) {
        setTimeout(this.check, 500)
      } else {
        this.link = ''
        this.swapId = null
      }
    }
  }
}
</script>
