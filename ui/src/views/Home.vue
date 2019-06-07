<template>
  <div>
    <div class="row mb-5">
      <div class="col-md-6">
        <div class="card">
          <div class="card-header">Node's addresses</div>
          <ul class="list-group list-group-flush">
            <li class="list-group-item font-weight-normal">BTC: {{addresses.btc}}</li>
            <li class="list-group-item font-weight-normal">ETH: 0x{{addresses.eth}}</li>
          </ul>
        </div>
      </div>
      <div class="col-md-6 text-center">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title mb-4">Paste the counter party link</h5>
            <input class="form-control form-control-lg" v-model="link" :readonly="swapId" />
            <button class="btn btn-lg btn-primary mt-4" v-if="link" @click="swap" :disabled="swapId">
              <span v-if="!(swapId && status !== 'done')">Swap</span>
              <Pacman class="loader-white mr-3" v-else />
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="row text-center">
      <div class="col-md-6 mx-auto">
        <div class="alert alert-success" v-if="status === 'reciprocated'">
          <h5 class="mb-0">Node has reciprocated the swap.</h5>
        </div>

        <div class="alert alert-success" v-if="status === 'done'">
          <h5 class="mb-0">Swap is now complete.</h5>
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
      addresses: {}
    }
  },
  mounted: async function () {
    const { data } = await this.$http.get('/api/addresses')

    this.addresses = data.data
  },
  methods: {
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
        setTimeout(this.check, 1000)
      } else {
        this.link = ''
        this.swapId = null
      }
    }
  }
}
</script>
